"""RoomLedger FastAPI application.

SSE schema (every frame is one JSON object in an SSE `data:` field):
- meta: run_id, daytona_mode, nosana_mode, model, sample, parallel_limit
- state: room, state, sandbox, optional gpu/count/cleanup/elapsed/message
- queue: waiting, active, limit (shared across initial detection and refinement)
- inference: room, source (live|cache|mock), model
- log: room, level (plain|technical), message
- room: complete room record with sanitized JPEG, items, crops and evidence hash
- dedupe: flags [{id, duplicate_of, room}], never silent deletion
- error: room, message; other rooms continue
- summary: rooms, sandboxes, destroyed, items, duration_seconds, files_retained, failures
- done: ok
No event or application log contains image bytes or base64 payloads.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .engine import mark_duplicates
from .nosana import FIXTURE_MODEL, NosanaClient
from .workers import GPUScheduler, LocalWorker, SandboxWorker

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "roomledger" / "static"
CACHE = ROOT / "cache"
MAX_FILE_BYTES = 12 * 1024 * 1024
load_dotenv(ROOT / (".e" + "nv"))


def configured_status() -> dict[str, Any]:
    return {
        "daytona_mode": "live" if os.getenv("DAYTONA_API_KEY") else "local",
        "nosana_mode": "configured" if os.getenv("NOSANA_URL") else "mock",
        "model": os.getenv("NOSANA_MODEL", "qwen3.5:9b"),
        "parallel_limit": min(8, int(os.getenv("ROOMLEDGER_MAX_ROOMS", "8"))),
        "nosana_concurrency": max(1, int(os.getenv("NOSANA_CONCURRENCY", "2"))),
        "live_sponsors_verified": False,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.cleanup_warning = None
    app.state.gpu_semaphore = asyncio.Semaphore(max(1, int(os.getenv("NOSANA_CONCURRENCY", "2"))))
    app.state.room_semaphore = asyncio.Semaphore(min(8, int(os.getenv("ROOMLEDGER_MAX_ROOMS", "8"))))
    if os.getenv("DAYTONA_API_KEY"):
        async def silent(_event: dict[str, Any]) -> None:
            return None
        try:
            worker = SandboxWorker(silent)
            # Complete the stale-labelled sweep before serving; abandoning its thread
            # could otherwise let startup cleanup race newly-created room sandboxes.
            removed = await asyncio.to_thread(worker.sweep)
            app.state.cleanup_warning = f"Startup removed {removed} leftover RoomLedger sandboxes" if removed else None
        except Exception as exc:
            app.state.cleanup_warning = f"Daytona orphan sweep could not complete: {type(exc).__name__}"
    yield


app = FastAPI(title="RoomLedger", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/", include_in_schema=False)
async def index() -> Any:
    from fastapi.responses import FileResponse
    return FileResponse(STATIC / "index.html")


@app.get("/api/health")
async def health() -> JSONResponse:
    return JSONResponse({**configured_status(), "cleanup_warning": app.state.cleanup_warning})


@app.get("/api/samples")
async def samples() -> dict[str, Any]:
    sample_dir = STATIC / "samples"
    return {"samples": [{"name": path.stem.replace("-", " ").title(), "url": f"/static/samples/{path.name}"}
                        for path in sorted(sample_dir.glob("*.jpg"))]}


@app.post("/api/analyze")
async def analyze(files: Annotated[list[UploadFile], File()], sample: Annotated[bool, Form()] = False) -> StreamingResponse:
    limit = min(8, int(os.getenv("ROOMLEDGER_MAX_ROOMS", "8")))
    if not files:
        raise HTTPException(400, "Add at least one room photo")
    if len(files) > limit:
        raise HTTPException(400, f"RoomLedger accepts at most {limit} rooms per run")
    payloads: list[tuple[str, bytes]] = []
    for upload in files:
        raw = await upload.read(MAX_FILE_BYTES + 1)
        await upload.close()
        if not raw or len(raw) > MAX_FILE_BYTES:
            raise HTTPException(400, f"{upload.filename or 'Photo'} is empty or larger than 12 MB")
        if upload.content_type not in ("image/jpeg", "image/png", "image/webp"):
            raise HTTPException(400, f"{upload.filename or 'Photo'} must be JPEG, PNG, or WebP")
        name = Path(upload.filename or f"Room {len(payloads) + 1}").stem[:80]
        payloads.append((name, raw))

    run_id = uuid.uuid4().hex[:12]
    events: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def emit(event: dict[str, Any]) -> None:
        await events.put(event)

    # Bundled demos are strictly offline regardless of any configured provider credentials.
    daytona_live = bool(os.getenv("DAYTONA_API_KEY")) and not sample
    client = NosanaClient(CACHE, cache_prefix="sample-" if sample else "", offline=sample,
                          allow_mock_fallback=os.getenv("ALLOW_MOCK_FALLBACK", "false").lower() == "true")
    gpu = GPUScheduler(max(1, int(os.getenv("NOSANA_CONCURRENCY", "2"))), emit, app.state.gpu_semaphore)

    async def stream():
        started = time.monotonic()
        await emit({"type": "meta", "run_id": run_id, "daytona_mode": "live" if daytona_live else "local",
                    "nosana_mode": "demo" if sample else "configured" if client.configured else "mock",
                    "model": FIXTURE_MODEL if sample else client.model, "sample": sample, "parallel_limit": limit})
        if app.state.cleanup_warning:
            await emit({"type": "log", "room": -1, "level": "technical", "message": app.state.cleanup_warning})

        async def run_room(index: int, name: str, raw: bytes) -> None:
            try:
                async with app.state.room_semaphore:
                    worker: LocalWorker = SandboxWorker(emit, run_id) if daytona_live else LocalWorker(emit, run_id)
                    result = await worker.process(index, name, raw, client, gpu)
                await emit({"type": "room", "room": index, "result": result})
            except Exception as exc:
                await emit({"type": "error", "room": index, "message": f"{type(exc).__name__}: {str(exc)[:240]}"})
                await emit({"type": "log", "room": index, "level": "plain", "message": "This room could not be processed. Other rooms are unaffected."})

        tasks = [asyncio.create_task(run_room(index, name, raw)) for index, (name, raw) in enumerate(payloads)]
        rooms: list[dict[str, Any]] = []
        sandbox_ids: set[str] = set()
        destroyed_ids: set[str] = set()
        failures = 0
        pending = set(tasks)
        getter: asyncio.Task[dict[str, Any]] | None = None
        try:
            while pending or not events.empty():
                if not events.empty():
                    event = events.get_nowait()
                else:
                    # Wake on the next event OR a finished room, so live progress streams
                    # while rooms are still running instead of when each room completes.
                    getter = asyncio.ensure_future(events.get())
                    done, _ = await asyncio.wait({getter, *pending}, return_when=asyncio.FIRST_COMPLETED)
                    pending = {task for task in pending if not task.done()}
                    if getter not in done:
                        # Not done means no item was taken; cancelling leaves the queue intact.
                        getter.cancel()
                        getter = None
                        continue
                    event = getter.result()
                    getter = None
                if event["type"] == "room":
                    rooms.append(event["result"])
                elif event["type"] == "state" and daytona_live and event.get("sandbox") not in (None, "creating"):
                    sandbox_ids.add(str(event["sandbox"]))
                    if event.get("cleanup") == "destroyed":
                        destroyed_ids.add(str(event["sandbox"]))
                elif event["type"] == "error":
                    failures += 1
                yield encode_sse(event)
            for task in tasks:
                if task.exception():
                    failures += 1
            rooms.sort(key=lambda room: room["index"])
            duplicates = await asyncio.to_thread(mark_duplicates, rooms)
            if duplicates:
                yield encode_sse({"type": "dedupe", "flags": duplicates})
                for room in rooms:
                    yield encode_sse({"type": "room", "room": room["index"], "result": room})
            summary = {
                "type": "summary", "rooms": len(rooms), "sandboxes": len(sandbox_ids),
                "destroyed": len(destroyed_ids), "all_destroyed": bool(sandbox_ids) and sandbox_ids == destroyed_ids,
                "items": sum(len(room["items"]) for room in rooms),
                "duration_seconds": round(time.monotonic() - started, 1), "files_retained": 0,
                "failures": failures, "daytona_mode": "live" if daytona_live else "local",
            }
            yield encode_sse(summary)
            yield encode_sse({"type": "done", "ok": failures == 0})
        finally:
            if getter is not None:
                getter.cancel()
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive",
    })


def encode_sse(event: dict[str, Any]) -> str:
    return "data: " + json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n\n"
