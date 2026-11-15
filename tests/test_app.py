from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import roomledger.app as application


def image_bytes(color="#8398a2") -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (120, 90), color).save(output, "JPEG")
    return output.getvalue()


def events(response_text: str):
    return [json.loads(line[6:]) for line in response_text.splitlines() if line.startswith("data: ")]


def test_health_and_samples_are_truthful(monkeypatch):
    monkeypatch.delenv("DAYTONA_API_KEY", raising=False)
    monkeypatch.delenv("NOSANA_URL", raising=False)
    with TestClient(application.app) as client:
        health = client.get("/api/health").json()
        assert health["daytona_mode"] == "local"
        assert health["nosana_mode"] == "mock"
        assert health["live_sponsors_verified"] is False
        samples = client.get("/api/samples").json()["samples"]
        assert len(samples) == 6


def test_end_to_end_mock_sse_and_real_cache(tmp_path, monkeypatch):
    monkeypatch.delenv("DAYTONA_API_KEY", raising=False)
    monkeypatch.delenv("NOSANA_URL", raising=False)
    monkeypatch.setattr(application, "CACHE", tmp_path)
    raw = image_bytes()
    with TestClient(application.app) as client:
        response = client.post("/api/analyze", files=[("files", ("Office.jpg", raw, "image/jpeg")),
                                                        ("files", ("Office.jpg", raw, "image/jpeg"))], data={"sample": "true"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    stream = events(response.text)
    assert stream[0]["type"] == "meta" and stream[0]["nosana_mode"] == "demo"
    rooms = list({event["result"]["id"]: event["result"] for event in stream if event["type"] == "room"}.values())
    assert len(rooms) == 2
    assert all(room["metadata_removed"] and len(room["items"]) == 4 for room in rooms)
    assert any(event["type"] == "dedupe" for event in stream)
    assert all(item["verified"] for item in rooms[0]["items"])
    assert all(item["crop"].startswith("data:image/jpeg;base64,") for item in rooms[0]["items"])
    assert stream[-2]["type"] == "summary" and stream[-2]["rooms"] == 2
    assert stream[-1] == {"type": "done", "ok": True}
    assert list(tmp_path.glob("sample-*.json"))
    for event in stream:
        if event["type"] == "log":
            assert "base64," not in event["message"]


def test_sample_never_uses_daytona_even_when_credentials_exist(tmp_path, monkeypatch):
    monkeypatch.setenv("DAYTONA_API_KEY", "fixture-credential-no-network-allowed")
    monkeypatch.delenv("NOSANA_URL", raising=False)
    monkeypatch.setattr(application, "CACHE", tmp_path)
    raw = image_bytes("#aa7744")

    class ForbiddenSandbox:
        def __init__(self, *args, **kwargs):
            raise AssertionError("Sample mode attempted to initialize a Daytona worker")

    monkeypatch.setattr(application, "SandboxWorker", ForbiddenSandbox)
    with TestClient(application.app) as client:
        # Startup cleanup reports the deliberately failed SDK initialization, but
        # the bundled analysis must remain local and must not invoke a provider.
        response = client.post("/api/analyze", files=[("files", ("sample-room.jpg", raw, "image/jpeg"))], data={"sample": "true"})
    stream = events(response.text)
    assert response.status_code == 200
    assert stream[0]["daytona_mode"] == "local"
    assert stream[0]["nosana_mode"] == "demo"
    assert stream[-1] == {"type": "done", "ok": True}
    assert any(event["type"] == "room" for event in stream)


def test_one_bad_room_does_not_break_good_room(tmp_path, monkeypatch):
    monkeypatch.delenv("DAYTONA_API_KEY", raising=False)
    monkeypatch.delenv("NOSANA_URL", raising=False)
    monkeypatch.setattr(application, "CACHE", tmp_path)
    with TestClient(application.app) as client:
        response = client.post("/api/analyze", files=[("files", ("bad.jpg", b"not a picture", "image/jpeg")),
                                                        ("files", ("good.jpg", image_bytes(), "image/jpeg"))])
    stream = events(response.text)
    assert any(event["type"] == "error" and event["room"] == 0 for event in stream)
    assert any(event["type"] == "room" and event["room"] == 1 for event in stream)
    assert stream[-2]["failures"] == 1
    assert stream[-1] == {"type": "done", "ok": False}


def test_upload_validation(monkeypatch):
    monkeypatch.delenv("DAYTONA_API_KEY", raising=False)
    with TestClient(application.app) as client:
        assert client.post("/api/analyze", files=[]).status_code in (400, 422)
        too_many = [("files", (f"{index}.jpg", image_bytes(), "image/jpeg")) for index in range(9)]
        assert client.post("/api/analyze", files=too_many).status_code == 400
        text = client.post("/api/analyze", files=[("files", ("fake.jpg", b"text", "text/plain"))])
        assert text.status_code == 400
