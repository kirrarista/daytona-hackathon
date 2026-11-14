from __future__ import annotations

import json
from pathlib import Path

import pytest

from roomledger.nosana import NosanaClient, extract_json


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


def test_cache_precedes_network_and_sample_is_offline(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("NOSANA_URL", "https://example.invalid/v1")
    monkeypatch.setenv("NOSANA_MODEL", "vision-test")
    client = NosanaClient(tmp_path, cache_prefix="sample-", offline=True)
    first = client.detect(b"same sanitized image")
    assert first.source == "mock"

    online = NosanaClient(tmp_path, cache_prefix="sample-", offline=False)
    # A configured endpoint still reads the exact sample cache without calling HTTP.
    second = online.detect(b"same sanitized image")
    assert second.source == "cache"
    assert list(tmp_path.glob("sample-*.json"))


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
