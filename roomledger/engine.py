"""Image and inventory operations that can run inside a disposable sandbox.

The module deliberately depends only on Pillow and the standard library. Its CLI
uses fixed JSON files so Daytona never needs to receive untrusted shell input.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000

CATEGORIES = ("electronics", "furniture", "appliance", "kitchenware", "decor", "clothing", "sports", "musical", "other")
CONDITIONS = ("new", "good", "fair", "poor")
CONDITION_FACTOR = {"new": 1.0, "good": 0.85, "fair": 0.65, "poor": 0.35}
DEPRECIATION = {
    "electronics": 0.20, "furniture": 0.10, "appliance": 0.14,
    "kitchenware": 0.12, "decor": 0.10, "clothing": 0.25,
    "sports": 0.16, "musical": 0.08, "other": 0.15,
}
PRICE_BANDS = {
    "electronics": (20, 12000), "furniture": (20, 15000),
    "appliance": (30, 10000), "kitchenware": (2, 2500),
    "decor": (2, 5000), "clothing": (2, 5000),
    "sports": (10, 12000), "musical": (50, 30000), "other": (1, 10000),
}
KEYWORD_BANDS = {
    "piano": (800, 30000), "bicycle": (80, 12000), "laptop": (150, 6000),
    "television": (100, 8000), "tv": (100, 8000), "refrigerator": (250, 7000),
    "sofa": (150, 10000), "bookshelf": (40, 3500), "bookcase": (40, 3500),
}
FIXES = {
    "tension_poles": {"product": "Tension poles / 突っ張り棒", "unit_jpy": 2400, "range_jpy": [1800, 3500]},
    "l_brackets": {"product": "L-brackets / L字金具", "unit_jpy": 1200, "range_jpy": [800, 2000]},
    "tv_straps": {"product": "TV anti-tip straps / テレビ転倒防止ベルト", "unit_jpy": 1800, "range_jpy": [1200, 2800]},
    "gel_mats": {"product": "Anti-slip gel mats / 耐震ジェルマット", "unit_jpy": 900, "range_jpy": [600, 1500]},
    "glass_film": {"product": "Shatter-protection glass film / 飛散防止フィルム", "unit_jpy": 1600, "range_jpy": [1000, 2500]},
    "fridge_belts": {"product": "Refrigerator belts / 冷蔵庫転倒防止ベルト", "unit_jpy": 2200, "range_jpy": [1600, 3200]},
}
RISK_FIXES = {
    "television": ["tv_straps"], "tv": ["tv_straps"],
    "refrigerator": ["fridge_belts"], "fridge": ["fridge_belts"],
    "bookshelf": ["tension_poles", "l_brackets"], "bookcase": ["tension_poles", "l_brackets"],
    "cabinet": ["l_brackets"], "wardrobe": ["tension_poles"],
    "glass": ["glass_film"], "mirror": ["glass_film"],
}


def sanitize(raw: bytes, max_side: int = 1024) -> tuple[bytes, dict[str, Any]]:
    """Decode untrusted input, remove all metadata, and encode a fresh JPEG."""
    if not raw:
        raise ValueError("The uploaded file is empty")
    with Image.open(io.BytesIO(raw)) as source:
        source.load()
        image = ImageOps.exif_transpose(source)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGBA")
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")
        original_size = image.size
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        # No exif= or icc_profile= argument is passed: this is a clean encoder state.
        image.save(output, format="JPEG", quality=88, optimize=True)
        clean = output.getvalue()
        metadata = {
            "width": image.width, "height": image.height,
            "original_width": original_size[0], "original_height": original_size[1],
            "sha256": hashlib.sha256(clean).hexdigest(),
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "metadata_removed": True,
        }
    with Image.open(io.BytesIO(clean)) as check:
        assert not check.getexif(), "EXIF survived sanitization"
    return clean, metadata


def clamp_price(label: str, category: str, value: Any) -> tuple[float, str | None]:
    try:
        price = float(value)
        if not math.isfinite(price):
            raise ValueError
    except (TypeError, ValueError):
        price = 0
    low, high = PRICE_BANDS.get(category, PRICE_BANDS["other"])
    override = next((word for word in KEYWORD_BANDS if re.search(rf"\b{re.escape(word)}\b", label.lower())), None)
    if override:
        low, high = KEYWORD_BANDS[override]
    adjusted = round(min(high, max(low, price)), 2)
    if abs(adjusted - round(price, 2)) < 0.01:
        return adjusted, None
    return adjusted, f"AI estimate adjusted to the typical {override or category} range (${low:,.0f}–${high:,.0f})"


def actual_cash_value(replacement: float, category: str, condition: str, age_years: int = 3) -> float:
    age = min(50, max(0, int(age_years or 0)))
    retained = (1 - DEPRECIATION.get(category, DEPRECIATION["other"])) ** age
    return round(replacement * CONDITION_FACTOR.get(condition, 0.65) * retained, 2)


def _suggest_risk(label: str, category: str, box: list[float], room_type: str) -> tuple[str, str, list[str]]:
    text = label.lower()
    fixes = next((value for key, value in RISK_FIXES.items() if key in text), [])
    tall = (box[3] - box[1]) >= 300
    if fixes and (category in ("furniture", "appliance") or tall):
        return "high", "Tall or heavy item could tip during strong shaking", fixes
    if fixes:
        return "medium", "Secure this item to reduce tip-over or impact risk", fixes
    if category in ("furniture", "appliance") and tall:
        return "medium", "Large item should be checked for stability", ["l_brackets"]
    return "low", "No major tip-over indicator detected", []


def prepare_items(raw_items: list[dict[str, Any]], width: int, height: int, room_type: str = "other") -> list[dict[str, Any]]:
    items = []
    for index, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            continue
        label = str(raw.get("label") or raw.get("name") or "Household item")[:160]
        category = str(raw.get("category", "other")).lower()
        if category not in CATEGORIES:
            category = "other"
        condition = str(raw.get("condition", "good")).lower()
        if condition not in CONDITIONS:
            condition = "good"
        if __package__:
            from .nosana import _normalise
        else:  # Daytona executes engine.py as a top-level script beside nosana.py.
            from nosana import _normalise
        try:
            box = _normalise(raw.get("box"), width, height)
        except (TypeError, ValueError):
            continue
        replacement, flag = clamp_price(label, category, raw.get("replacement_usd", raw.get("price_usd", raw.get("price", 100))))
        try:
            age = max(0, min(50, int(raw.get("age_years", 3) or 0)))
        except (TypeError, ValueError):
            age = 3
        risk = str(raw.get("risk", "")).lower()
        suggested_risk, suggested_reason, fixes = _suggest_risk(label, category, box, room_type)
        if risk not in ("low", "medium", "high"):
            risk = suggested_risk
        reason = str(raw.get("risk_reason") or suggested_reason)[:300]
        try:
            confidence = max(0.0, min(1.0, float(raw.get("confidence", 0.6) or 0)))
        except (TypeError, ValueError):
            confidence = 0.6
        item = {
            "id": f"item-{index + 1}", "label": label, "category": category,
            "condition": condition, "box": box, "replacement_usd": replacement,
            "acv_usd": actual_cash_value(replacement, category, condition, age),
            "age_years": age, "risk": risk, "risk_reason": reason,
            "near_bed_or_exit": bool(raw.get("near_bed_or_exit", False)),
            "fix_keys": fixes, "verified": False,
            "confidence": confidence,
            "price_flag": flag, "duplicate_of": None, "receipt": False,
            "brand_model": str(raw.get("brand_model", ""))[:160],
        }
        items.append(item)
    return items


def crop_item(image_bytes: bytes, box: list[float], max_side: int = 512) -> bytes:
    with Image.open(io.BytesIO(image_bytes)) as source:
        image = source.convert("RGB")
        x0, y0, x1, y1 = [value / 1000 for value in box]
        pad_x, pad_y = (x1 - x0) * 0.08, (y1 - y0) * 0.08
        bounds = (
            max(0, int((x0 - pad_x) * image.width)), max(0, int((y0 - pad_y) * image.height)),
            min(image.width, math.ceil((x1 + pad_x) * image.width)), min(image.height, math.ceil((y1 + pad_y) * image.height)),
        )
        if bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
            raise ValueError("Cannot crop an empty bounding box")
        crop = image.crop(bounds)
        crop.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        crop.save(out, "JPEG", quality=90)
        return out.getvalue()


def merge_refinement(item: dict[str, Any], refinement: dict[str, Any]) -> dict[str, Any]:
    merged = dict(item)
    exact_name = str(refinement.get("label") or refinement.get("exact_name") or "").strip()
    if exact_name:
        merged["label"] = exact_name[:160]
    condition = str(refinement.get("condition", item["condition"])).lower()
    if condition in CONDITIONS:
        merged["condition"] = condition
    price, flag = clamp_price(merged["label"], item["category"], refinement.get("replacement_usd", item["replacement_usd"]))
    merged["replacement_usd"] = price
    merged["price_flag"] = flag
    merged["acv_usd"] = actual_cash_value(price, item["category"], merged["condition"], item.get("age_years", 3))
    merged["brand_model"] = str(refinement.get("brand_model") or refinement.get("model") or item.get("brand_model", ""))[:160]
    merged["verified"] = True
    try:
        merged["confidence"] = max(0.0, min(1.0, float(refinement.get("confidence", 0.8))))
    except (TypeError, ValueError):
        merged["confidence"] = 0.8
    return merged


def readiness_score(rooms: list[dict[str, Any]]) -> int:
    """100 − (8/high + 3/medium) × 1.5 for bedrooms, divided by √room count."""
    if not rooms:
        return 100
    penalty = 0.0
    for room in rooms:
        multiplier = 1.5 if room.get("room_type") == "bedroom" else 1.0
        for item in room.get("items", []):
            penalty += (8 if item.get("risk") == "high" else 3 if item.get("risk") == "medium" else 0) * multiplier
    return max(0, min(100, round(100 - penalty / math.sqrt(len(rooms)))))


def shopping_list(rooms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    quantities: dict[str, int] = {}
    for room in rooms:
        for item in room.get("items", []):
            if item.get("risk") == "low":
                continue
            for key in item.get("fix_keys", []):
                if key in FIXES:
                    quantities[key] = quantities.get(key, 0) + 1
    return [{"key": key, **FIXES[key], "quantity": quantity, "estimated_jpy": FIXES[key]["unit_jpy"] * quantity}
            for key, quantity in sorted(quantities.items())]


def mark_duplicates(rooms: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Flag likely repeats within a named room; never delete an item."""
    seen: dict[tuple[str, str, str], dict[str, Any]] = {}
    duplicates = []
    for room in rooms:
        room_key = re.sub(r"\W+", "", str(room.get("name", "")).lower())
        for item in room.get("items", []):
            key = (room_key, item["label"].strip().lower(), item["category"])
            previous = seen.get(key)
            if previous and previous["replacement_usd"] > 0 and abs(previous["replacement_usd"] - item["replacement_usd"]) / previous["replacement_usd"] <= 0.20:
                item["duplicate_of"] = previous["id"]
                duplicates.append({"id": item["id"], "duplicate_of": previous["id"], "room": room["id"]})
            else:
                seen[key] = item
    return duplicates


def _load(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _save(path: str, data: Any) -> None:
    Path(path).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _cli() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    clean = sub.add_parser("sanitize")
    clean.add_argument("source"), clean.add_argument("destination"), clean.add_argument("metadata"), clean.add_argument("--max-side", type=int, default=1024)
    prepare = sub.add_parser("prepare")
    prepare.add_argument("image"), prepare.add_argument("detections"), prepare.add_argument("result"), prepare.add_argument("crop_dir")
    final = sub.add_parser("finalize")
    final.add_argument("prepared"), final.add_argument("refinements"), final.add_argument("result")
    args = parser.parse_args()
    if args.command == "sanitize":
        cleaned, metadata = sanitize(Path(args.source).read_bytes(), args.max_side)
        Path(args.destination).write_bytes(cleaned)
        _save(args.metadata, metadata)
        return
    if args.command == "prepare":
        image_bytes = Path(args.image).read_bytes()
        detection = _load(args.detections)
        items = prepare_items(detection.get("items", []), detection["width"], detection["height"], detection.get("room_type", "other"))
        crop_dir = Path(args.crop_dir)
        crop_dir.mkdir(exist_ok=True)
        for item in items:
            crop_path = crop_dir / f"{item['id']}.jpg"
            crop_path.write_bytes(crop_item(image_bytes, item["box"]))
            item["crop_file"] = str(crop_path)
        _save(args.result, {"room_type": detection.get("room_type", "other"), "items": items})
        return
    prepared, refinements = _load(args.prepared), _load(args.refinements)
    for index, item in enumerate(prepared["items"]):
        refinement = refinements.get(item["id"])
        if refinement:
            prepared["items"][index] = merge_refinement(item, refinement)
    _save(args.result, prepared)


if __name__ == "__main__":
    # Sandbox files are uploaded together and engine is run as a top-level module.
    import sys
    sys.modules.setdefault("roomledger", type(sys)("roomledger"))
    sys.modules["roomledger"].__path__ = [str(Path(__file__).resolve().parent)]  # type: ignore[attr-defined]
    _cli()
