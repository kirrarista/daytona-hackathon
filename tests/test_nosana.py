from __future__ import annotations

import json
from pathlib import Path

import pytest

from roomledger.nosana import FIXTURE_KEY_MODEL, NosanaClient, extract_json


@pytest.mark.parametrize("raw", [
    '```json\n{"items": [1]}\n```',
    '<think>private chain of thought</think>{"room_type":"office","items":[]}',
    'I found this result:\n {"items":[{"label":"TV"}]} trailing prose',
    ' [ {"box": [0,0,1,1]} ] ',
])
def test_extract_json_formats(raw):
    assert isinstance(extract_json(raw), (dict, list))


def test_extract_json_rejects_empty_or_invalid():
    with pytest.raises(ValueError):
        extract_json("No usable object here")


def test_thinking_decoy_is_never_selected():
    raw = '<think>{"items":[{"label":"decoy"}]}</think>{"items":[{"label":"final answer"}]}'
    assert extract_json(raw)["items"][0]["label"] == "final answer"


def test_cache_precedes_network_and_sample_is_offline(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("NOSANA_URL", "https://example.invalid/v1")
    monkeypatch.setenv("NOSANA_MODEL", "vision-test")
    client = NosanaClient(tmp_path, cache_prefix="sample-", offline=True)
    first = client.detect(b"same sanitized image")
    assert first.source == "mock"

    def no_network(*args, **kwargs):
        raise AssertionError("Offline cache unexpectedly used HTTP")

    monkeypatch.setattr("urllib.request.urlopen", no_network)
    second = NosanaClient(tmp_path, cache_prefix="sample-", offline=True).detect(b"same sanitized image")
    assert second.source == "cache" and second.model == "roomledger-offline-fixture"
    payload = json.loads(next(tmp_path.glob("sample-*.json")).read_text())
    assert payload["origin"] == "mock" and payload["model"] == "roomledger-offline-fixture"

    online = NosanaClient(tmp_path, cache_prefix="sample-", offline=False)
    assert online._namespace != client._namespace, "Live endpoint cannot consume offline mock provenance"
    monkeypatch.setenv("NOSANA_URL", "https://different.example/v1")
    other = NosanaClient(tmp_path, cache_prefix="sample-", offline=False)
    assert other._namespace != online._namespace, "Different endpoints need separate cache namespaces"


def test_refinement_cache_is_record_specific(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("NOSANA_URL", raising=False)
    client = NosanaClient(tmp_path)
    one = client.refine(b"crop", {"label": "TV", "replacement_usd": 500})
    two = client.refine(b"crop", {"label": "Laptop", "replacement_usd": 900})
    assert one.data["exact_name"] == "TV"
    assert two.data["exact_name"] == "Laptop"
    assert len(list(tmp_path.glob("*.json"))) == 2


def test_mock_is_deterministic(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("NOSANA_URL", raising=False)
    first = NosanaClient(tmp_path / "a").detect(b"room image")
    second = NosanaClient(tmp_path / "b").detect(b"room image")
    assert first.data == second.data
    assert first.model == "roomledger-offline-fixture"


def test_offline_fixture_cache_key_ignores_configured_model(tmp_path, monkeypatch):
    """A live NOSANA_MODEL in the dotenv must not orphan the committed sample-home cache."""
    monkeypatch.delenv("NOSANA_URL", raising=False)
    monkeypatch.setenv("NOSANA_MODEL", FIXTURE_KEY_MODEL)
    baseline = NosanaClient(tmp_path, cache_prefix="sample-", offline=True)._cache_path(b"image", "detect-v3", "prompt")
    monkeypatch.setenv("NOSANA_MODEL", "some-live-model-27b")
    configured_elsewhere = NosanaClient(tmp_path, cache_prefix="sample-", offline=True)
    assert configured_elsewhere._cache_path(b"image", "detect-v3", "prompt") == baseline
    monkeypatch.setenv("NOSANA_URL", "https://deployment.invalid")
    live = NosanaClient(tmp_path)
    assert live._cache_path(b"image", "detect-v3", "prompt") != baseline
