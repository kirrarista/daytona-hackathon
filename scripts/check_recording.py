"""Verify that browser acceptance produced a complete non-trivial recording and evidence."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"


def main() -> None:
    recording = ARTIFACTS / "roomledger-demo.webm"
    assert recording.is_file() and recording.stat().st_size > 10_000, "No usable demo recording"
    summary_path = ARTIFACTS / "browser-summary.json"
    summary = json.loads(summary_path.read_text())
    assert summary["rooms"] == 6 and summary["items"] == 24
    assert summary["external_requests"] == 0 and summary["mobile_width"] == 390
    for name in ("01-welcome.png", "02-inventory-desktop.png", "03-quake-japanese.png", "04-report.png", "05-inventory-mobile.png"):
        path = ARTIFACTS / name
        assert path.is_file() and path.stat().st_size > 5000, f"Missing or empty screenshot: {name}"
    print(f"ROOMLEDGER_RECORDING_OK: {recording.stat().st_size:,} byte offline demo plus five reviewed screenshots")


if __name__ == "__main__":
    main()
