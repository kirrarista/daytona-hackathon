"""Local and Daytona room workers with one bounded GPU queue across all rooms."""
from __future__ import annotations

import asyncio
import base64
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Awaitable, Callable

from .engine import crop_item, merge_refinement, prepare_items, sanitize
from .nosana import InferenceResult, NosanaClient

Emit = Callable[[dict[str, Any]], Awaitable[None]]


class GPUScheduler:
    def __init__(self, limit: int, emit: Emit):
        self.semaphore = asyncio.Semaphore(limit)
        self.limit = limit
        self.waiting = 0
        self.active = 0
        self.emit = emit
        self.timeout = float(os.getenv("NOSANA_TIMEOUT", "60")) + 15

    async def _queue_event(self) -> None:
        await self.emit({"type": "queue", "waiting": self.waiting, "active": self.active, "limit": self.limit})

    @asynccontextmanager
    async def slot(self):
        self.waiting += 1
        await self._queue_event()
        try:
            await asyncio.wait_for(self.semaphore.acquire(), timeout=self.timeout)
        finally:
            self.waiting -= 1
            await self._queue_event()
        self.active += 1
        await self._queue_event()
        try:
            yield
        finally:
            self.active -= 1
            self.semaphore.release()
            await self._queue_event()

    async def run(self, function: Callable[..., InferenceResult], *args: Any) -> InferenceResult:
        async with self.slot():
            return await asyncio.wait_for(asyncio.to_thread(function, *args), timeout=self.timeout)


class LocalWorker:
    live = False

    def __init__(self, emit: Emit):
        self.emit = emit
        self.max_side = int(os.getenv("ROOMLEDGER_MAX_SIDE", "1024"))
        self.refine_count = int(os.getenv("ROOMLEDGER_REFINE_COUNT", "6"))

    async def state(self, room: int, state: str, worker_id: str, **extra: Any) -> None:
        await self.emit({"type": "state", "room": room, "state": state, "sandbox": worker_id, **extra})

    async def process(self, room: int, name: str, raw: bytes, client: NosanaClient, gpu: GPUScheduler) -> dict[str, Any]:
        worker_id = f"local-{room + 1:02d}"
        await self.state(room, "creating", worker_id)
        await self.state(room, "sanitizing", worker_id)
        clean, metadata = await asyncio.to_thread(sanitize, raw, self.max_side)
        await self.emit({"type": "log", "room": room, "level": "plain", "message": "GPS and photo metadata removed"})
        await self.state(room, "detecting", worker_id, gpu=True)
        detection = await gpu.run(client.detect, clean)
        await self._inference_log(room, detection, len(detection.data.get("items", [])))
        await self.state(room, "scoring", worker_id)
        room_type = str(detection.data.get("room_type", "other"))
        prepared = await asyncio.to_thread(prepare_items, detection.data.get("items", []), metadata["width"], metadata["height"], room_type)
        crops = [await asyncio.to_thread(crop_item, clean, item["box"]) for item in prepared]
        prepared, crops = await self._refine(room, worker_id, client, gpu, prepared, crops)
        result = self._room_result(room, name, clean, metadata, room_type, prepared, crops)
        await self.state(room, "released", worker_id, cleanup="released", elapsed=0)
        return result

    async def _inference_log(self, room: int, result: InferenceResult, count: int) -> None:
        await self.emit({"type": "inference", "room": room, "source": result.source, "model": result.model})
        suffix = f" · HTTP {result.http_ms} ms" if result.http_ms else ""
        await self.emit({"type": "log", "room": room, "level": "technical",
                         "message": f"{result.source.upper()} · {result.model} · {count} detections{suffix}"})

    async def _refine(self, room: int, worker_id: str, client: NosanaClient, gpu: GPUScheduler,
                      items: list[dict[str, Any]], crops: list[bytes]) -> tuple[list[dict[str, Any]], list[bytes]]:
        candidates = sorted(range(len(items)), key=lambda index: items[index]["replacement_usd"], reverse=True)[:self.refine_count]
        if not candidates:
            return items, crops
        await self.state(room, "refining", worker_id, count=len(candidates))
        await self.emit({"type": "log", "room": room, "level": "plain", "message": f"Refining {len(candidates)} high-value items…"})

        async def verify(index: int) -> tuple[int, InferenceResult]:
            return index, await gpu.run(client.refine, crops[index], items[index])

        outcomes = await asyncio.gather(*(verify(index) for index in candidates), return_exceptions=True)
        for outcome in outcomes:
            if isinstance(outcome, BaseException):
                await self.emit({"type": "log", "room": room, "level": "technical",
                                 "message": f"Refinement skipped: {type(outcome).__name__}; original estimate retained"})
                continue
            index, result = outcome
            items[index] = merge_refinement(items[index], result.data)
            await self._inference_log(room, result, 1)
        return items, crops

    @staticmethod
    def _room_result(room: int, name: str, clean: bytes, metadata: dict[str, Any], room_type: str,
                     items: list[dict[str, Any]], crops: list[bytes]) -> dict[str, Any]:
        for index, item in enumerate(items):
            item["id"] = f"r{room + 1}-{item['id']}"
            item["index"] = index + 1
            item["crop"] = "data:image/jpeg;base64," + base64.b64encode(crops[index]).decode("ascii")
            item.pop("crop_file", None)
        return {
            "id": f"room-{room + 1}", "index": room, "name": name,
            "room_type": room_type, "items": items, **metadata,
            "image": "data:image/jpeg;base64," + base64.b64encode(clean).decode("ascii"),
        }


class SandboxWorker(LocalWorker):
    """Run every Pillow decode/crop/valuation operation inside Daytona.

    GPU inference is transported by the host solely to enforce one global Nosana
    semaphore across independent sandboxes. Only sanitized images/crops leave it.
    """
    live = True

    def __init__(self, emit: Emit):
        super().__init__(emit)
        from daytona import Daytona, DaytonaConfig
        config = DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"], api_url=os.getenv("DAYTONA_API_URL") or None)
        self.daytona = Daytona(config)
        self.snapshot = os.getenv("DAYTONA_SNAPSHOT", "").strip()

    async def _call(self, function: Callable[..., Any], *args: Any, timeout: float = 90) -> Any:
        return await asyncio.wait_for(asyncio.to_thread(function, *args), timeout=timeout)

    def sweep(self) -> int:
        """Delete only sandboxes explicitly labelled as belonging to RoomLedger."""
        from daytona import ListSandboxesQuery
        deleted = 0
        for sandbox in self.daytona.list(ListSandboxesQuery(labels={"app": "roomledger"})):
            sandbox.delete(timeout=30)
            deleted += 1
        return deleted

    def _create(self, run_id: str):
        from daytona import CreateSandboxFromImageParams, CreateSandboxFromSnapshotParams, Image
        common = {
            "language": "python", "labels": {"app": "roomledger", "run": run_id},
            "auto_stop_interval": 0, "ttl_minutes": 30,
        }
        if self.snapshot:
            params = CreateSandboxFromSnapshotParams(snapshot=self.snapshot, **common)
        else:
            image = Image.debian_slim("3.12").pip_install(["Pillow"]).workdir("/home/daytona")
            params = CreateSandboxFromImageParams(image=image, **common)
        return self.daytona.create(params, timeout=90)

    @staticmethod
    def _check(response: Any) -> None:
        if getattr(response, "exit_code", 1) != 0:
            # Engine commands emit no image content; retain bounded stderr/stdout metadata only.
            detail = str(getattr(response, "result", "sandbox command failed"))[-800:]
            raise RuntimeError(f"Sandbox command failed: {detail}")

    async def process(self, room: int, name: str, raw: bytes, client: NosanaClient, gpu: GPUScheduler) -> dict[str, Any]:
        sandbox = None
        worker_id = "creating"
        started = asyncio.get_running_loop().time()
        try:
            await self.state(room, "creating", worker_id)
            run_id = os.getenv("ROOMLEDGER_RUN_ID", "manual")[:48]
            sandbox = await self._call(self._create, run_id, timeout=100)
            worker_id = str(sandbox.id)
            await self.state(room, "sanitizing", worker_id)
            engine_bytes = Path(__file__).with_name("engine.py").read_bytes()
            nosana_bytes = Path(__file__).with_name("nosana.py").read_bytes()
            await self._call(sandbox.fs.upload_file, raw, "input.upload")
            await self._call(sandbox.fs.upload_file, engine_bytes, "engine.py")
            await self._call(sandbox.fs.upload_file, nosana_bytes, "nosana.py")
            response = await self._call(sandbox.process.exec, f"python3 engine.py sanitize input.upload sanitized.jpg metadata.json --max-side {self.max_side}", timeout=90)
            self._check(response)
            clean = await self._call(sandbox.fs.download_file, "sanitized.jpg")
            metadata = json.loads((await self._call(sandbox.fs.download_file, "metadata.json")).decode("utf-8"))
            await self.emit({"type": "log", "room": room, "level": "plain", "message": f"Sandbox {worker_id[:8]} removed GPS and photo metadata"})
            await self.state(room, "detecting", worker_id, gpu=True)
            detection = await gpu.run(client.detect, clean)
            await self._inference_log(room, detection, len(detection.data.get("items", [])))
            detection_payload = {**detection.data, "width": metadata["width"], "height": metadata["height"]}
            await self._call(sandbox.fs.upload_file, json.dumps(detection_payload).encode("utf-8"), "detections.json")
            await self.state(room, "scoring", worker_id)
            response = await self._call(sandbox.process.exec, "python3 engine.py prepare sanitized.jpg detections.json prepared.json crops", timeout=90)
            self._check(response)
            prepared_data = json.loads((await self._call(sandbox.fs.download_file, "prepared.json")).decode("utf-8"))
            prepared = prepared_data["items"]
            crops = []
            for item in prepared:
                crops.append(await self._call(sandbox.fs.download_file, item["crop_file"]))
            # Crop paths are local to the sandbox and never become public evidence.
            for item in prepared:
                item.pop("crop_file", None)
            prepared, crops = await self._refine(room, worker_id, client, gpu, prepared, crops)
            # Re-run merging in the sandbox if refinement changed any original records.
            refinements = {item["id"]: {key: item[key] for key in ("label", "condition", "replacement_usd", "brand_model", "confidence")}
                           for item in prepared if item.get("verified")}
            if refinements:
                # Download the untouched prepared file again as the merge base.
                await self._call(sandbox.fs.upload_file, json.dumps(refinements).encode("utf-8"), "refinements.json")
                response = await self._call(sandbox.process.exec, "python3 engine.py finalize prepared.json refinements.json finalized.json", timeout=60)
                self._check(response)
                prepared = json.loads((await self._call(sandbox.fs.download_file, "finalized.json")).decode("utf-8"))["items"]
            result = self._room_result(room, name, clean, metadata, prepared_data["room_type"], prepared, crops)
            return result
        finally:
            if sandbox is not None:
                try:
                    await self._call(sandbox.delete, timeout=45)
                    await self.state(room, "destroyed", worker_id, cleanup="destroyed", elapsed=round(asyncio.get_running_loop().time() - started, 2))
                    await self.emit({"type": "log", "room": room, "level": "technical", "message": f"Daytona sandbox {worker_id} destroyed"})
                except Exception as exc:
                    await self.emit({"type": "state", "room": room, "state": "cleanup_failed", "sandbox": worker_id,
                                     "cleanup": "failed", "message": f"Deletion needs review: {type(exc).__name__}"})
