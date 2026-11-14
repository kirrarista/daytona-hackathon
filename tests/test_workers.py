from __future__ import annotations

import asyncio
import io
import threading
import time
from types import SimpleNamespace

import pytest
from PIL import Image

from roomledger.nosana import NosanaClient
from roomledger.workers import GPUScheduler, LocalWorker, SandboxWorker


def run(coroutine):
    return asyncio.run(coroutine)


def test_gpu_scheduler_enforces_one_global_limit():
    async def scenario():
        emitted = []

        async def emit(event):
            emitted.append(event)

        scheduler = GPUScheduler(2, emit)
        lock = threading.Lock()
        active = peak = 0

        def work(identity):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.02)
            with lock:
                active -= 1
            return identity

        assert await asyncio.gather(*(scheduler.run(work, index) for index in range(8))) == list(range(8))
        assert peak == 2
        assert emitted[-1]["waiting"] == 0 and emitted[-1]["active"] == 0
        assert all(event["limit"] == 2 for event in emitted)

    run(scenario())


def test_sandbox_is_deleted_when_processing_raises(tmp_path):
    class FailingProcess:
        def exec(self, *args, **kwargs):
            raise RuntimeError("simulated sandbox failure")

    class FakeFilesystem:
        def upload_file(self, *args):
            return None

    class FakeSandbox:
        id = "sandbox-test-123"
        fs = FakeFilesystem()
        process = FailingProcess()
        deleted = False
        waited = False

        def delete(self, timeout=None, wait=False):
            self.deleted = True
            self.waited = wait

    async def scenario(events):
        worker = SandboxWorker.__new__(SandboxWorker)
        worker.emit = events.emit
        worker.max_side = 1024
        worker.refine_count = 1
        worker.run_id = "test"
        worker.snapshot = ""
        sandbox = FakeSandbox()
        worker._create = lambda run_id, cancelled=None: sandbox
        with pytest.raises(RuntimeError, match="simulated"):
            await worker.process(0, "Room", b"raw", object(), object())
        assert sandbox.deleted and sandbox.waited

    class Events(list):
        async def emit(self, event):
            self.append(event)

    events = Events()
    run(scenario(events))
    assert events[-1]["type"] == "log" and "destroyed" in events[-1]["message"]
    assert any(event.get("cleanup") == "destroyed" for event in events if event["type"] == "state")


def test_failed_refinement_retains_original_values(tmp_path, monkeypatch):
    monkeypatch.delenv("NOSANA_URL", raising=False)
    client = NosanaClient(tmp_path)

    def fail_refinement(*args):
        raise TimeoutError("GPU timed out")

    monkeypatch.setattr(client, "refine", fail_refinement)

    async def scenario():
        events = []

        async def emit(event):
            events.append(event)

        image = io.BytesIO()
        Image.new("RGB", (100, 80), "#789").save(image, "JPEG")
        result = await LocalWorker(emit).process(0, "Room", image.getvalue(), client, GPUScheduler(2, emit))
        assert result["items"]
        assert all(not item["verified"] for item in result["items"])
        assert any("original estimate retained" in event["message"] for event in events if event["type"] == "log")

    run(scenario())


def test_refinement_limit_never_exceeds_six(monkeypatch):
    monkeypatch.setenv("ROOMLEDGER_REFINE_COUNT", "100")

    async def emit(event):
        return None

    assert LocalWorker(emit).refine_count == 6


def test_orphan_sweep_is_label_scoped_and_create_has_ttl():
    class FakeDaytona:
        def __init__(self):
            self.query = None
            self.create_params = None

        def list(self, query, request_timeout):
            self.query = query
            return []

        def create(self, params, timeout):
            self.create_params = params
            return SimpleNamespace(id="created-only-in-fixture")

    worker = SandboxWorker.__new__(SandboxWorker)
    fake = FakeDaytona()
    worker.daytona = fake
    assert worker.sweep() == 0
    assert fake.query.labels == {"app": "roomledger"}
    worker.snapshot = "roomledger-pillow"
    worker._create("run-123")
    assert fake.create_params.labels == {"app": "roomledger", "run": "run-123"}
    assert fake.create_params.ttl_minutes == 30
    assert fake.create_params.snapshot == "roomledger-pillow"


def test_gpu_permit_is_held_until_cancelled_thread_finishes():
    async def scenario():
        emitted = []

        async def emit(event):
            emitted.append(event)

        shared = asyncio.Semaphore(1)
        scheduler = GPUScheduler(1, emit, shared)
        scheduler.timeout = 2
        entered = threading.Event()
        finish = threading.Event()
        finished = threading.Event()
        second_ran = threading.Event()

        def blocking():
            entered.set()
            finish.wait(2)
            finished.set()
            return "done"

        def second():
            second_ran.set()
            return "second"

        first = asyncio.create_task(scheduler.run(blocking))
        assert await asyncio.to_thread(entered.wait, 1)
        first.cancel()
        await asyncio.sleep(0.05)
        waiting = asyncio.create_task(scheduler.run(second))
        await asyncio.sleep(0.05)
        assert not second_ran.is_set(), "A new request acquired the semaphore while old HTTP was active"
        finish.set()
        with pytest.raises(asyncio.CancelledError):
            await first
        assert await waiting == "second"
        assert finished.is_set() and second_ran.is_set()
        assert shared._value == 1

    run(scenario())


def test_creation_timeout_reconciles_known_id_and_late_creation():
    class CreationTimeout(Exception):
        sandbox_id = "orphan-123"

    class Remote:
        def __init__(self):
            self.delete_kwargs = None

        def delete(self, **kwargs):
            self.delete_kwargs = kwargs

    class FakeDaytona:
        def __init__(self):
            self.remote = Remote()
            self.fail = True

        def create(self, params, timeout):
            if self.fail:
                raise CreationTimeout("startup timed out")
            return self.remote

        def get(self, sandbox_id, request_timeout):
            assert sandbox_id == "orphan-123"
            return self.remote

    worker = SandboxWorker.__new__(SandboxWorker)
    worker.daytona = FakeDaytona()
    worker.snapshot = "roomledger-pillow"
    with pytest.raises(CreationTimeout):
        worker._create("run")
    assert worker.daytona.remote.delete_kwargs == {"timeout": 25, "wait": True}
    worker.daytona.fail = False
    cancelled = threading.Event()
    cancelled.set()
    with pytest.raises(TimeoutError):
        worker._create("run", cancelled)
    assert worker.daytona.remote.delete_kwargs == {"timeout": 40, "wait": True}


def test_sandbox_refinement_returns_raw_json_without_host_merge(tmp_path):
    async def scenario():
        emitted = []

        async def emit(event):
            emitted.append(event)

        worker = SandboxWorker.__new__(SandboxWorker)
        worker.emit = emit
        worker.refine_count = 6

        def refine(crop, item):
            from roomledger.nosana import InferenceResult
            return InferenceResult({"exact_name": "4K OLED TV", "replacement_usd": 1100, "condition": "fair"}, "live", "vision-test")

        item = {"id": "item-1", "label": "Television", "replacement_usd": 900}
        prepared, crops, refinements = await worker._refine(0, "sandbox", SimpleNamespace(refine=refine), GPUScheduler(1, emit), [item], [b"crop"])
        assert prepared[0] is item and item == {"id": "item-1", "label": "Television", "replacement_usd": 900}
        assert refinements["item-1"]["replacement_usd"] == 1100
        assert crops == [b"crop"]

    run(scenario())


def test_coordinate_parser_rejects_non_finite_values():
    import math
    from roomledger.nosana import _normalise
    with pytest.raises(ValueError):
        _normalise([math.nan, 10, 100, 100], 100, 100)
