from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path

import pytest
from PIL import Image
from PIL.TiffImagePlugin import IFDRational

from roomledger import engine


def jpeg_with_gps() -> bytes:
    image = Image.new("RGB", (80, 60), "#aa8866")
    exif = Image.Exif()
    exif[0x0110] = "Private camera model"
    exif[0x8825] = {
        1: "N", 2: ((IFDRational(35, 1), IFDRational(41, 1), IFDRational(0, 1)),),
        3: "E", 4: ((IFDRational(139, 1), IFDRational(41, 1), IFDRational(0, 1)),),
    }
    output = io.BytesIO()
    # Use a simpler valid GPS payload if the runtime normalizes nested tuples.
    exif[0x8825] = {1: "N", 2: (IFDRational(35, 1), IFDRational(41, 1), IFDRational(0, 1)),
                    3: "E", 4: (IFDRational(139, 1), IFDRational(41, 1), IFDRational(0, 1))}
    image.save(output, "JPEG", exif=exif)
    return output.getvalue()


def test_sanitize_strips_gps_and_all_exif():
    raw = jpeg_with_gps()
    with Image.open(io.BytesIO(raw)) as before:
        assert 0x8825 in before.getexif()
    clean, metadata = engine.sanitize(raw, 40)
    with Image.open(io.BytesIO(clean)) as after:
        assert not after.getexif()
        assert after.size == (40, 30)
    assert metadata["metadata_removed"] is True
    assert len(metadata["sha256"]) == 64
    assert metadata["original_width"] == 80


@pytest.mark.parametrize("box,expected", [
    ([100, 50, 400, 250], [100, 50, 400, 250]),
    ([0.1, 0.05, 0.4, 0.25], [100, 50, 400, 250]),
    ([120, 60, 480, 300], [100, 50, 400, 250]),
])
def test_normalise_formats(box, expected):
    from roomledger.nosana import _normalise
    # First two values in the pixel case exceed 1000 only with larger coordinates;
    # explicitly declaring pixel units mirrors a response-format hint.
    assume_pixels = box == [120, 60, 480, 300]
    assert _normalise(box, 1200, 1200, assume_pixels=assume_pixels) == expected


def test_normalise_clips_sorts_and_rejects_empty():
    from roomledger.nosana import _normalise
    assert _normalise([1200, -10, 900, 600], 1000, 1000, assume_pixels=True) == [900, 0, 1000, 600]
    assert _normalise({"x": 0.8, "y": 0.2, "width": 0.1, "height": 0.3}, 100, 100) == [800, 200, 900, 500]
    with pytest.raises(ValueError):
        _normalise([10, 10, 10, 20], 100, 100)


def test_price_bands_keyword_override_and_neutral_input():
    price, flag = engine.clamp_price("Gaming laptop", "electronics", 40)
    assert price == 150
    assert "laptop" in flag
    assert engine.clamp_price("Laptop", "electronics", 900) == (900, None)
    assert engine.clamp_price("Ordinary thing", "other", "not-a-number")[0] == 1


def test_depreciation_and_condition_math():
    assert engine.actual_cash_value(1000, "electronics", "new", 3) == 512
    assert engine.actual_cash_value(1000, "furniture", "good", 0) == 850
    assert engine.actual_cash_value(1000, "electronics", "poor", -9) == 350


def test_prepare_refinement_keeps_evidence_box_and_updates_acv():
    raw = [{"label": "Tall bookshelf", "category": "furniture", "replacement_usd": 500,
            "box": [1, 2, 499, 800], "risk": "high", "confidence": "bad"},
            {"label": "Bad geometry", "box": [0, 0, 0, 0]},
            {"label": "Missing geometry", "box": None}]
    items = engine.prepare_items(raw, 1200, 900, "bedroom")
    assert len(items) == 1
    before_box = items[0]["box"]
    refined = engine.merge_refinement(items[0], {"exact_name": "Oak bookshelf", "replacement_usd": 700,
                                                   "condition": "fair", "confidence": 1.9})
    assert refined["box"] == before_box
    assert refined["verified"] and refined["confidence"] == 1
    assert refined["acv_usd"] < 700


def test_readiness_bedroom_weight_and_shopping_quantities():
    high = {"risk": "high", "fix_keys": ["tension_poles"]}
    medium = {"risk": "medium", "fix_keys": ["tension_poles"]}
    bedroom = {"room_type": "bedroom", "items": [high]}
    living = {"room_type": "living_room", "items": [high, medium]}
    assert engine.readiness_score([bedroom]) == 88
    assert engine.readiness_score([]) == 100
    empty = {"room_type": "other", "items": []}
    assert engine.readiness_score([bedroom, empty]) < engine.readiness_score([{"room_type": "living_room", "items": [high]}, empty])
    fixes = engine.shopping_list([bedroom, living])
    assert fixes[0]["quantity"] == 3
    assert fixes[0]["estimated_jpy"] == fixes[0]["unit_jpy"] * 3


def test_duplicates_are_scoped_to_room_name_and_never_deleted():
    item = {"id": "a", "label": "Laptop", "category": "electronics", "replacement_usd": 1000, "duplicate_of": None}
    same = {**item, "id": "b", "replacement_usd": 1100}
    different = {"id": "c", **item}
    rooms = [{"id": "1", "name": "Office", "items": [item, same]},
             {"id": "2", "name": "Bedroom", "items": [different]}]
    flags = engine.mark_duplicates(rooms)
    assert flags == [{"id": "b", "duplicate_of": "a", "room": "1"}]
    assert len(rooms[0]["items"]) == 2 and different["duplicate_of"] is None


def test_engine_sandbox_cli_round_trip(tmp_path: Path):
    raw = jpeg_with_gps()
    source = tmp_path / "input.jpg"
    source.write_bytes(raw)
    subprocess.run([sys.executable, "roomledger/engine.py", "sanitize", str(source), str(tmp_path / "clean.jpg"),
                    str(tmp_path / "meta.json")], check=True)
    detection = {"room_type": "office", "width": 80, "height": 60,
                 "items": [{"label": "Laptop", "category": "electronics", "replacement_usd": 800,
                            "box": [10, 10, 800, 800]}]}
    (tmp_path / "detection.json").write_text(json.dumps(detection))
    subprocess.run([sys.executable, "roomledger/engine.py", "prepare", str(tmp_path / "clean.jpg"),
                    str(tmp_path / "detection.json"), str(tmp_path / "prepared.json"), str(tmp_path / "crops")], check=True)
    prepared = json.loads((tmp_path / "prepared.json").read_text())
    assert prepared["items"][0]["verified"] is False
    assert Path(prepared["items"][0]["crop_file"]).is_file()
