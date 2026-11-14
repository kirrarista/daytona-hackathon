"""Static acceptance checks for assets and high-risk product claims."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    samples = sorted((ROOT / "roomledger/static/samples").glob("*.jpg"))
    require(len(samples) == 6, "Sample home needs six photographs")
    require(len({hashlib.sha256(path.read_bytes()).hexdigest() for path in samples}) == 6, "Sample photographs must be unique")
    cache = list((ROOT / "cache").glob("sample-*.json"))
    require(len(cache) >= 24, "Detection and refinement responses must be pre-cached")
    for path in cache:
        payload = json.loads(path.read_text())
        require(isinstance(payload.get("data"), dict), f"Malformed cache: {path.name}")
    readme = (ROOT / "README.md").read_text()
    for phrase in ("Honest sponsor usage", "Daytona", "Nosana", "not proof", "0 uploaded photo files retained",
                   "AI estimates — verify with receipts. Not an insurance appraisal.", "Two-minute demonstration"):
        require(phrase in readme, f"README lacks required wording: {phrase}")
    app = (ROOT / "roomledger/app.py").read_text()
    for event in ("meta:", "state:", "queue:", "inference:", "dedupe:", "summary:"):
        require(event in app, f"SSE schema documentation lacks {event}")
    for filename in ("index.html", "styles.css", "app.js"):
        path = ROOT / "roomledger/static" / filename
        require(path.is_file() and path.stat().st_size > 1000, f"Frontend incomplete: {filename}")
    js = (ROOT / "roomledger/static/app.js").read_text()
    html = (ROOT / "roomledger/static/index.html").read_text()
    css = (ROOT / "roomledger/static/styles.css").read_text()
    require("<script src=\"http" not in html and "<link href=\"http" not in html and "@import" not in css, "Frontend must not use remote assets")
    for key in ("reportGenerated", "readinessFormula", "deleteNamed", "summaryLocal", "localizedMessage"):
        require(key in js, f"Complete localization path missing: {key}")
    for element in ("sample-button", "mode-quake", "language-toggle", "readiness-score", "report-button", "csv-button", "theme-toggle"):
        require(element in js or element in (ROOT / "roomledger/static/index.html").read_text(), f"Missing UI control {element}")
    require((ROOT / "scripts/browser_check.py").is_file(), "Browser acceptance script missing")
    print(f"ROOMLEDGER_PROJECT_OK: 6 unique samples, {len(cache)} cached responses, honest docs, complete local frontend")


if __name__ == "__main__":
    main()
