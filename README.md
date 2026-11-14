# Room**Ledger**

**Photograph your home. Leave with a claim-ready contents ledger and an earthquake fix list.**

After a fire, flood, theft, or earthquake, memory is a poor inventory. RoomLedger turns room photographs into an editable replacement-value and actual-cash-value ledger, identifies furniture that could fall in strong shaking, and packages the evidence as a printable report or insurer-friendly CSV.

## Run the complete offline demo

Requires Python 3.11+ and a Chromium-based browser for the optional visual checks.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/uvicorn roomledger.app:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** and choose **Try with sample home**. The app defaults to the report-inspired warm-white, ink, and brown theme; the header's **Dark mode** toggle restores the dark workbench and saves the preference in this browser (`roomledger-theme` in local storage). Reports always stay light for printing. A persistent **日本語 / EN** control sits beside the theme toggle in the header: it is available before upload and in every mode, translates the complete interface and printable report—including dynamic fleet/queue states, plain-language logs, the inspector, dialogs, errors, and toast summaries—and saves `roomledger-language` locally. Existing logs, open dialogs, and run summaries re-render on language changes. Model-generated item names, user-entered evidence text, IDs, hashes, coordinates, currencies, and raw technical diagnostics remain unchanged. Six original illustrated room photographs exercise the entire workflow with no third-party network access. The bundled results are pre-cached deterministic fixtures, not claimed live AI detections. Replace the illustrations with licensed sample photographs by editing `scripts/generate_samples.py` and regenerating their cache.

Upload 1–8 JPEG, PNG, or WebP files (12 MB each) for your own offline/local run. Click any numbered box or inventory row to edit label, condition, replacement price, receipt status, or deletion. **Quake-Ready** changes the same evidence into prioritized tip-over fixes and supports English / 日本語. **Report** opens print-ready HTML; **CSV** downloads the current edited inventory.

The UI always distinguishes `Local decoding`, `offline model fixtures`, `cache`, `live`, and `demo`. A local run never displays a fake Daytona sandbox or Nosana inference badge.

## Honest sponsor usage

When the corresponding settings are supplied:

- **Nosana hosts the open vision model** (configured with `NOSANA_MODEL`, default `qwen3.5:9b`) through an OpenAI-compatible endpoint that detects, values, and verifies items. This is open-weights inference on decentralized GPUs—not a fallback to a big-tech vision API. `source=LIVE`, the model name, and measured HTTP latency appear only after a real response. Cache reads remain labelled cache.
- **Daytona runs one disposable sandbox per room, in parallel** (up to eight). Untrusted image decoding, EXIF/GPS stripping, cropping, price/ACV scoring, quake-risk preparation, and refinement merging all execute there. The host transports sanitized images to Nosana solely to enforce one global GPU queue across otherwise independent sandboxes. Sandboxes have a 30-minute TTL and are explicitly deleted in `finally` on success or failure.

The initial build environment contained **no sponsor credentials or real room photographs**. The installed SDK was introspected and the offline flow was verified, but real Daytona creation/deletion and real Nosana vision accuracy remain a required deployment check. No live verification is claimed in this repository or the UI. A failed configured provider is an error; it never silently becomes mock output. `ALLOW_MOCK_FALLBACK` is available only for explicit development use and must remain false in a sponsor demo.

## Configure live providers

Copy `.env.example` to a local dotenv file, then provide:

```sh
DAYTONA_API_KEY=...
NOSANA_URL=https://your-vision-deployment.example
NOSANA_API_KEY=...                 # required by Nosana's hosted inference API
NOSANA_MODEL=qwen3.5:9b            # replace with an actually serving VL model
NOSANA_CONCURRENCY=2
NOSANA_TIMEOUT=60
```

For Nosana's hosted API, `NOSANA_URL` is the OpenAI-compatible base ending in `/v1`; a deployment base URL or full `/chat/completions` URL also works. Inspect `/models` on the serving endpoint and select a genuinely vision-capable Qwen VL-family model. The default name is configuration, **not proof that such a deployment exists**. Reasoning suppression is requested by default; one bounded retry without that field handles endpoints that reject it. Thinking tags are stripped regardless.

Install and verify the exact provider SDK:

```sh
.venv/bin/python -m pip install -r requirements-daytona.txt
.venv/bin/python smoke_nosana.py /path/to/real-room.jpg
```

The smoke test refuses non-Nosana/substitute providers and saves `artifacts/nosana-boxes.png`. **Open that image and inspect alignment** before a demonstration. If latency exceeds 60 seconds, keep `ROOMLEDGER_MAX_SIDE=1024` and reduce `ROOMLEDGER_ITEM_CAP` to 15 or lower.

The adapter was written against **Daytona Python SDK 0.231.1** and checked with runtime signatures, including `Daytona.create`, `fs.upload_file(bytes, remote_path)`, `fs.download_file(remote_path)`, and `process.exec(command, ...)`. Without `DAYTONA_SNAPSHOT`, creation uses `Image.debian_slim("3.12").pip_install(["Pillow"])`, allowing Daytona to cache and reuse the declarative image. For a faster production cold start, pre-build a snapshot from that image and set `DAYTONA_SNAPSHOT` to its ID.

At startup, RoomLedger waits for completion of a sweep scoped to sandboxes labelled `app=roomledger` and created at least five minutes before the sweep, preventing startup cleanup from racing newly-created rooms. Normal and reconciled deletion uses the SDK's `wait=True`; “destroyed” is emitted only after Daytona confirms it. Check the Daytona dashboard after every live acceptance run. `cleanup_failed` is shown explicitly if deletion needs review.

## How a run works

```text
Photos (1–8)
  └─ one isolated worker per room, concurrently
      ├─ decode + strip metadata + re-encode JPEG + SHA-256
      ├─ room-wide object detection       ┐
      ├─ normalized boxes + price/risk    │
      ├─ 512 px evidence crops            │ shared Nosana semaphore
      └─ top ≤6 item verification         ┘  (default: 2 active calls)
  └─ cross-photo duplicate suggestions (same room name, label/category, ±20% price)
  └─ client-side edits → printable report + CSV
```

Every item has a stable ID. Second-pass verification replaces only the editable descriptive/value fields while retaining its original box, evidence crop, and room association. Duplicate candidates are never silently deleted. Price-band adjustments are shown with ⚠ and preserve a readable reason. Cache files contain origin/model/result JSON keyed by hashes. A live endpoint namespace is derived from its normalized URL hash, so providers and mock/live provenance cannot be exchanged silently. No photo bytes or raw endpoint credentials are cached by the server. The run-summary wording is therefore **“0 uploaded photo files retained,”** not a claim that no metadata exists. Browser memory retains the active ledger until refresh.

### Evidence and estimates

Each sanitized photograph receives a SHA-256 fingerprint and UTC processing timestamp. The report places that fingerprint beside its matching photograph and in the evidence appendix. This makes later file replacement detectable; it does not prove when a photograph was originally taken.

Replacement estimates are clamped to conservative category bands with keyword overrides for pianos, bicycles, laptops, televisions, refrigerators, sofas, and bookshelves. ACV is:

```text
replacement × condition factor × (1 − annual category depreciation) ^ age
condition: new 1.00 · good 0.85 · fair 0.65 · poor 0.35
annual depreciation: electronics 20% · furniture 10% · appliance 14% · kitchenware/decor 12/10%
clothing 25% · sports 16% · musical 8% · other 15%
```

Readiness is **100 − (8 per high risk + 3 per medium risk), with bedroom penalties ×1.5, divided by the square root of analyzed room count**, clamped to 0–100. Medium/high hazards near a bed or exit are prioritized; the score is a triage aid, not an engineering certification. Shopping quantities are grouped across rooms. Prices are fixed indicative JPY ranges in `engine.py`, not retailer quotes. Inventory values remain USD; no implicit currency conversion occurs.

## Outputs and testing

- **Printable HTML report:** cover totals/ACV/readiness, editable inventory with crops and receipts, numbered photos and legends, fix/shopping list, scoring method, matching photo fingerprints, and the disclaimer **“AI estimates — verify with receipts. Not an insurance appraisal.”**
- **CSV:** current edited state, verification, receipts, ACV, and evidence hashes, with spreadsheet-formula escaping.
- **Server-Sent Events:** additive schema documented in `roomledger/app.py`; metadata-only logs, queued/active GPU counts, room-level errors and explicit cleanup outcomes.

```sh
.venv/bin/python -m pytest -q
.venv/bin/python scripts/browser_check.py
.venv/bin/python scripts/check_project.py
```

Tests cover EXIF/GPS removal, encodings and malformed output, price/ACV/risk logic, refinement preservation, dedupe scope, the exact sandbox CLI, cache behavior, upload limits, complete SSE, and one-room failure isolation. Browser acceptance inspects six rooms, fleet completion, editing, quake/Japanese mode, report contents, CSV download, and mobile overflow; screenshots and the offline backup recording are written under `artifacts/`.

## Two-minute demonstration

- **0:00** — “After a disaster, people can't prove what they owned, and in Japan the furniture itself is the danger.”
- **0:10** — Drop six room photos. Fleet tiles light up; live runs show independent Daytona sandboxes and GPS-stripped notices.
- **0:35** — Numbered boxes appear, totals build, and the television shows its crop and verified valuation.
- **0:55** — Switch to **Quake-Ready**. Risks recolor, Readiness appears, sleeping hazards rise to the top; switch to 日本語.
- **1:20** — Open the printable report: cover, inventory, numbered evidence, shopping list, and fingerprints.
- **1:40** — Close on actual cleanup: “Six sandboxes, all destroyed, no uploaded photo files retained. Open-model vision on Nosana.” Use this line only on a fully live run; offline uses “six local workers and cached sample fixtures.”
