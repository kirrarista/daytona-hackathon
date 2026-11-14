"""Generate original illustrated sample rooms and their zero-network inference cache."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw

from roomledger.engine import crop_item, prepare_items, sanitize
from roomledger.nosana import NosanaClient

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "roomledger" / "static" / "samples"
CACHE = ROOT / "cache"
ROOMS = [("entry-bedroom", "bedroom"), ("living-room-west", "living_room"), ("family-kitchen", "kitchen"),
         ("work-studio", "office"), ("reading-room", "living_room"), ("main-bedroom", "bedroom")]


def illustration(room_type: str, nonce: int) -> Image.Image:
    image = Image.new("RGB", (1200, 900), "#c5bfae")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1200, 610), fill="#b8b4a7")
    draw.polygon([(0, 610), (1200, 610), (1200, 900), (0, 900)], fill="#776c5a")
    for x in range(0, 1201, 130):
        draw.line((x, 610, x + 90, 900), fill="#8c7c66", width=3)
    draw.rectangle((50, 80, 300, 370), fill="#57707a")
    draw.rectangle((70, 100, 280, 350), fill="#b5d0d1")
    draw.line((175, 100, 175, 350), fill="#57707a", width=8)
    # Mild deterministic paint variation makes each evidence photo unique.
    draw.rectangle((0, 0, 12, 12), fill=(nonce % 250, 110, 120))
    if room_type == "bedroom":
        draw.rectangle((445, 500, 1030, 790), fill="#443d38")
        draw.rectangle((470, 460, 1000, 715), fill="#d4c9aa")
        draw.rectangle((500, 485, 720, 565), fill="#eee8dc")
        draw.rectangle((100, 110, 400, 745), fill="#67513e")
        for y in (300, 500):
            draw.line((115, y, 390, y), fill="#8a6d50", width=8)
        draw.rectangle((760, 80, 990, 390), fill="#4e453b")
        draw.rectangle((780, 100, 970, 370), fill="#8aa1a3")
    elif room_type == "living_room":
        draw.rectangle((85, 100, 335, 660), fill="#584638")
        for y in range(150, 620, 90):
            draw.line((95, y, 325, y), fill="#b59665", width=9)
        draw.rectangle((370, 215, 780, 470), fill="#242b31")
        draw.rectangle((390, 235, 760, 450), fill="#526b70")
        draw.rectangle((520, 470, 630, 540), fill="#39322c")
        draw.rectangle((195, 610, 965, 820), fill="#576462")
        draw.rectangle((240, 540, 550, 690), fill="#71817a")
        draw.rectangle((630, 540, 920, 690), fill="#71817a")
    elif room_type == "kitchen":
        draw.rectangle((725, 100, 1080, 790), fill="#afb6b2")
        draw.line((725, 450, 1080, 450), fill="#737d79", width=8)
        draw.rectangle((190, 280, 540, 450), fill="#343c3e")
        draw.rectangle((220, 305, 510, 420), fill="#718484")
        draw.rectangle((90, 500, 680, 550), fill="#d6c7a8")
        draw.rectangle((120, 550, 650, 790), fill="#665847")
        draw.rectangle((385, 525, 540, 570), fill="#8c5b35")
    else:
        draw.rectangle((75, 90, 350, 690), fill="#5f4c3c")
        for y in range(140, 650, 85):
            draw.line((85, y, 340, y), fill="#c09559", width=9)
        draw.rectangle((245, 590, 960, 690), fill="#6d513c")
        draw.rectangle((380, 400, 680, 620), fill="#293b46")
        draw.rectangle((405, 425, 655, 585), fill="#789aa0")
        draw.rectangle((700, 330, 940, 550), fill="#303b40")
        draw.rectangle((720, 350, 920, 525), fill="#799da1")
    return image


def main() -> None:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    client = NosanaClient(CACHE, cache_prefix="sample-", offline=True)
    for filename, target_type in ROOMS:
        for nonce in range(1000):
            image = illustration(target_type, nonce)
            destination = SAMPLES / f"{filename}.jpg"
            image.save(destination, "JPEG", quality=92)
            clean, metadata = sanitize(destination.read_bytes(), 1024)
            probe = client._mock_detection(clean)
            if probe["room_type"] == target_type:
                break
        else:
            raise RuntimeError(f"Could not make a deterministic {target_type} sample")
        detection = client.detect(clean)
        assert detection.source in ("cache", "mock")
        items = prepare_items(detection.data["items"], metadata["width"], metadata["height"], target_type)
        for item in items:
            crop = crop_item(clean, item["box"])
            refined = client.refine(crop, item)
            assert refined.source in ("cache", "mock")
        print(f"sample cached: {filename} · {len(items)} items")


if __name__ == "__main__":
    main()
