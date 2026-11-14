"""Live Nosana smoke test: python smoke_nosana.py path/to/room.jpg"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw

from roomledger.nosana import NosanaClient


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--output", type=Path, default=Path("artifacts/nosana-boxes.png"))
    args = parser.parse_args()
    if not os.getenv("NOSANA_URL"):
        raise SystemExit("NOSANA_URL is required; this smoke test never substitutes another provider.")
    from roomledger.engine import sanitize
    clean, _ = sanitize(args.image.read_bytes(), 1024)
    result = NosanaClient(Path("cache")).detect(clean)
    if result.source != "live":
        raise SystemExit(f"Expected live inference, got {result.source}")
    with Image.open(__import__("io").BytesIO(clean)) as opened:
        image = opened.convert("RGB")
    draw = ImageDraw.Draw(image)
    for index, item in enumerate(result.data.get("items", []), 1):
        from roomledger.nosana import _normalise
        box = _normalise(item.get("box"), image.width, image.height)
        coords = [box[0] / 1000 * image.width, box[1] / 1000 * image.height,
                  box[2] / 1000 * image.width, box[3] / 1000 * image.height]
        draw.rectangle(coords, outline="#efc968", width=4)
        draw.text((coords[0] + 4, coords[1] + 4), f"{index} {item.get('label', '')}", fill="#101722", stroke_width=2, stroke_fill="#efc968")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output)
    print(json.dumps({"source": result.source, "model": result.model, "items": len(result.data.get("items", [])),
                      "http_ms": result.http_ms, "overlay": str(args.output)}, indent=2))
    print("Open the overlay and visually confirm every box before running a demo.")


if __name__ == "__main__":
    main()
