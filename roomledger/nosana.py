"""Nosana OpenAI-compatible vision inference, robust parsing, and disk cache."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DETECTION_PROMPT = """Inspect this room photograph for a home insurance and earthquake-safety inventory.
Return JSON only: {"room_type":"bedroom|living_room|kitchen|office|other","items":[...]}.
Identify at most {cap} distinct visible household objects, not pixels or architectural features.
Each item needs: label, category (electronics, furniture, appliance, kitchenware, decor, clothing, sports, musical, other),
condition (new, good, fair, poor), replacement_usd (realistic new replacement cost), age_years,
box [x0,y0,x1,y1] normalized from 0 to 1000 relative to the full image, risk (low, medium, high),
risk_reason, near_bed_or_exit (true only when it could strike a sleeping person or block an exit), confidence (0 to 1).
Prioritize wardrobes, bookshelves, cabinets, televisions, refrigerators, glass and other falling hazards.
Do not invent brands, hidden objects, receipts, or exact model numbers."""

REFINEMENT_PROMPT = """This is a crop of one household item from an insurance inventory. Return JSON only with:
exact_name (specific but never invented), brand_model (visible branding/model or an empty string),
condition (new, good, fair, poor), replacement_usd (new equivalent replacement price), confidence (0 to 1).
The provisional record is {record}. Correct it only when the crop provides evidence. Do not describe the crop outside JSON."""


def extract_json(text: str) -> Any:
    """Extract a JSON object/array from fenced, thinking, or prefixed prose output."""
    if not isinstance(text, str):
        raise ValueError("Model response content was not text")
    cleaned = re.sub(r"<think\b[^>]*>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned.strip(), flags=re.IGNORECASE).strip()
    decoder = json.JSONDecoder()
    for index, character in enumerate(cleaned):
        if character not in "[{":
            continue
        try:
            value, _ = decoder.raw_decode(cleaned[index:])
            return value
        except json.JSONDecodeError:
            continue
    raise ValueError("No complete JSON object or array found in model response")


def _normalise(box: Any, width: int, height: int, assume_pixels: bool = False) -> list[float]:
    """Normalize fractional, pixel, or 0–1000 boxes and clip to valid bounds."""
    if isinstance(box, dict):
        if {"x0", "y0", "x1", "y1"}.issubset(box):
            values = [box["x0"], box["y0"], box["x1"], box["y1"]]
        elif {"x", "y", "width", "height"}.issubset(box):
            values = [box["x"], box["y"], box["x"] + box["width"], box["y"] + box["height"]]
        else:
            raise ValueError("Bounding box object lacks coordinates")
    else:
        values = list(box or [])
    if len(values) != 4:
        raise ValueError("Bounding box must have four coordinates")
    try:
        values = [float(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise ValueError("Bounding box coordinates must be numeric") from exc
    if assume_pixels or max(values) > 1000:
        values = [values[0] / width * 1000, values[1] / height * 1000, values[2] / width * 1000, values[3] / height * 1000]
    elif max(values) <= 1.5 and min(values) >= 0:
        values = [value * 1000 for value in values]
    x0, x1 = sorted((max(0, min(1000, values[0])), max(0, min(1000, values[2]))))
    y0, y1 = sorted((max(0, min(1000, values[1])), max(0, min(1000, values[3]))))
    if x1 - x0 < 1 or y1 - y0 < 1:
        raise ValueError("Bounding box is empty")
    return [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]


@dataclass
class InferenceResult:
    data: dict[str, Any]
    source: str
    model: str
    http_ms: int = 0


class NosanaClient:
    """Synchronous transport intended to be called through asyncio.to_thread."""

    def __init__(self, cache_dir: Path, cache_prefix: str = "", allow_mock_fallback: bool = False, offline: bool = False):
        self.url = os.getenv("NOSANA_URL", "").strip().rstrip("/")
        self.offline = offline
        self.model = os.getenv("NOSANA_MODEL", "qwen3.5:9b")
        self.api_key = os.getenv("NOSANA_API_KEY", "").strip()
        self.timeout = float(os.getenv("NOSANA_TIMEOUT", "60"))
        self.max_items = int(os.getenv("ROOMLEDGER_ITEM_CAP", "15"))
        self.cache_dir = cache_dir
        self.cache_prefix = cache_prefix
        self.allow_mock_fallback = allow_mock_fallback
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @property
    def configured(self) -> bool:
        return bool(self.url) and not self.offline

    def _endpoint(self) -> str:
        if self.url.endswith("/chat/completions"):
            return self.url
        return f"{self.url}/chat/completions" if self.url.endswith("/v1") else f"{self.url}/v1/chat/completions"

    def _cache_path(self, image: bytes, operation: str, prompt: str) -> Path:
        digest = hashlib.sha256(operation.encode() + b"\0" + self.model.encode() + b"\0" + prompt.encode() + b"\0" + image).hexdigest()
        safe_prefix = re.sub(r"[^a-z0-9-]", "", self.cache_prefix.lower())
        return self.cache_dir / f"{safe_prefix}{digest}.json"

    def _cached(self, path: Path) -> InferenceResult | None:
        if not path.is_file():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            return InferenceResult(payload["data"], "cache", payload.get("model", self.model))
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def _save_cache(self, path: Path, data: dict[str, Any]) -> None:
        temporary = path.with_suffix(f".{os.getpid()}.{uuid.uuid4().hex}.tmp")
        temporary.write_text(json.dumps({"model": self.model, "data": data}, ensure_ascii=False), encoding="utf-8")
        temporary.replace(path)

    def detect(self, image: bytes) -> InferenceResult:
        prompt = DETECTION_PROMPT.replace("{cap}", str(self.max_items))
        cache = self._cache_path(image, "detect-v3", prompt)
        cached = self._cached(cache)
        if cached:
            return cached
        if self.configured:
            try:
                result = self._vision(prompt, image, 4500)
                parsed = extract_json(result.data["content"])
                if isinstance(parsed, list):
                    parsed = {"room_type": "other", "items": parsed}
                if not isinstance(parsed.get("items"), list):
                    raise ValueError("Detection JSON has no items array")
                parsed["items"] = parsed["items"][:self.max_items]
                self._save_cache(cache, parsed)
                return InferenceResult(parsed, "live", self.model, result.http_ms)
            except Exception:
                if not self.allow_mock_fallback:
                    raise
        # Mock is explicit when no endpoint is configured, or explicitly enabled as a fallback.
        parsed = self._mock_detection(image)
        self._save_cache(cache, parsed)
        return InferenceResult(parsed, "mock", "roomledger-offline-fixture")

    def refine(self, crop: bytes, record: dict[str, Any]) -> InferenceResult:
        public_record = {key: record.get(key) for key in ("label", "category", "condition", "replacement_usd", "brand_model")}
        prompt = REFINEMENT_PROMPT.replace("{record}", json.dumps(public_record, ensure_ascii=False))
        cache = self._cache_path(crop, "refine-v2", prompt)
        cached = self._cached(cache)
        if cached:
            return cached
        if self.configured:
            try:
                result = self._vision(prompt, crop, 700)
                parsed = extract_json(result.data["content"])
                if not isinstance(parsed, dict):
                    raise ValueError("Refinement response was not an object")
                self._save_cache(cache, parsed)
                return InferenceResult(parsed, "live", self.model, result.http_ms)
            except Exception:
                if not self.allow_mock_fallback:
                    raise
        parsed = {
            "exact_name": record["label"], "brand_model": record.get("brand_model", ""),
            "condition": record.get("condition", "good"),
            "replacement_usd": record.get("replacement_usd", 100), "confidence": 0.87,
        }
        self._save_cache(cache, parsed)
        return InferenceResult(parsed, "mock", "roomledger-offline-fixture")

    def _vision(self, prompt: str, image: bytes, max_tokens: int) -> InferenceResult:
        encoded = base64.b64encode(image).decode("ascii")
        payload = {
            "model": self.model, "temperature": 0.1, "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}},
            ]}],
        }
        reasoning = os.getenv("NOSANA_REASONING", "none").strip()
        if reasoning:
            payload["reasoning_effort"] = reasoning
        result = self._post(payload)
        choices = result.get("choices") or []
        content = choices[0].get("message", {}).get("content") if choices else None
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        if not content:
            raise ValueError("Nosana returned an empty vision response")
        return InferenceResult({"content": content}, "live", self.model, result["_http_ms"])

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        # Only metadata is ever exposed by errors. The payload contains image bytes and is never logged.
        request = urllib.request.Request(
            self._endpoint(), data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {self.api_key}"} if self.api_key else {})},
            method="POST",
        )
        started = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # Some OpenAI-compatible builds reject reasoning_effort; retry that one field only on 400.
            if exc.code == 400 and "reasoning_effort" in payload:
                retry = dict(payload)
                retry.pop("reasoning_effort")
                return self._post_without_reasoning(retry, started)
            raise RuntimeError(f"Nosana HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Nosana connection failed: {exc.reason}") from exc
        result["_http_ms"] = round((time.monotonic() - started) * 1000)
        return result

    def _post_without_reasoning(self, payload: dict[str, Any], started: float) -> dict[str, Any]:
        request = urllib.request.Request(
            self._endpoint(), data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {self.api_key}"} if self.api_key else {})},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
        result["_http_ms"] = round((time.monotonic() - started) * 1000)
        return result

    def _mock_detection(self, image: bytes) -> dict[str, Any]:
        """Deterministic offline fixtures; clearly distinguished from model inference."""
        digest = hashlib.sha256(image).digest()
        room_type = ("bedroom", "living_room", "kitchen", "office")[digest[0] % 4]
        sets = {
            "bedroom": [
                ("Oak wardrobe", "furniture", 780, [100, 70, 430, 840], "high", True),
                ("Bedside table", "furniture", 140, [520, 590, 740, 850], "low", False),
                ("Table lamp", "electronics", 65, [590, 390, 700, 610], "low", False),
                ("Framed mirror", "decor", 110, [760, 130, 920, 510], "medium", False),
            ],
            "living_room": [
                ("65-inch television", "electronics", 900, [330, 280, 690, 550], "high", False),
                ("Three-seat sofa", "furniture", 1200, [180, 610, 800, 900], "low", False),
                ("Tall bookcase", "furniture", 420, [60, 100, 280, 700], "high", False),
                ("Coffee table", "furniture", 260, [360, 680, 650, 840], "low", False),
            ],
            "kitchen": [
                ("Refrigerator", "appliance", 1450, [610, 110, 890, 880], "high", False),
                ("Microwave oven", "appliance", 180, [260, 320, 470, 490], "medium", False),
                ("Dining chairs", "furniture", 320, [180, 620, 520, 900], "low", False),
                ("Cookware set", "kitchenware", 240, [360, 530, 550, 690], "low", False),
            ],
            "office": [
                ("Laptop computer", "electronics", 1350, [330, 470, 630, 710], "low", False),
                ("Office desk", "furniture", 580, [220, 610, 760, 880], "low", False),
                ("Tall bookshelf", "furniture", 460, [60, 90, 290, 720], "high", True),
                ("Desk monitor", "electronics", 340, [580, 370, 790, 620], "medium", False),
            ],
        }
        items = []
        for index, (label, category, price, box, risk, near) in enumerate(sets[room_type]):
            items.append({
                "label": label, "category": category, "condition": "good",
                "replacement_usd": price, "age_years": 2 + index, "box": box,
                "risk": risk, "risk_reason": "Secure this item to prevent tip-over" if risk == "high" else "Review placement and stability",
                "near_bed_or_exit": near, "confidence": 0.82,
            })
        return {"room_type": room_type, "items": items}


def smoke(image_path: Path, output_path: Path) -> None:
    """Run one real/provider-configured detection and print metadata only."""
    from .engine import sanitize
    raw, metadata = sanitize(image_path.read_bytes(), 1024)
    client = NosanaClient(Path("cache"))
    started = time.monotonic()
    result = client.detect(raw)
    print(json.dumps({"source": result.source, "model": result.model, "room_type": result.data.get("room_type"),
                      "items": len(result.data.get("items", [])), "elapsed_seconds": round(time.monotonic() - started, 2),
                      "sha256": metadata["sha256"]}, indent=2))
    output_path.write_text(json.dumps(result.data, indent=2), encoding="utf-8")
