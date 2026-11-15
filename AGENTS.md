# RoomLedger contributor guide

## Architecture

- `roomledger/app.py`: FastAPI, upload limits, SSE orchestration. The documented additive event contract lives at the top of this file.
- `roomledger/workers.py`: shared async GPU semaphore and room-local `LocalWorker` / `SandboxWorker` pipelines. Host-side network inference is used only so concurrency stays global across otherwise independent Daytona sandboxes.
- `roomledger/engine.py`: the only image decoder/cropper. It runs on the host only in visibly labelled local/demo mode, and inside Daytona in live mode. It also owns valuation, ACV, dedupe, readiness, and shopping calculations.
- `roomledger/nosana.py`: OpenAI-compatible Nosana vision transport, defensive JSON/box parsing, deterministic offline fixture generation, and result-only disk cache.
- `roomledger/static/`: local vanilla HTML/CSS/JS; no CDN, framework, bundler, or external font dependency. Theme-scoped tokens default to the printable report's light paper/ink/brown palette; `html[data-theme="dark"]` restores the dark workbench. The theme toggle persists `roomledger-theme` in browser local storage, suppresses transitions during swaps, and never changes the always-light printable report. The adjacent always-visible language control persists `roomledger-language` and translates all interface and report strings through `UI_TEXT`/`sharedText`, including dynamic fleet, queue, logs, inspector, dialogs, errors, toasts, and report methods. Raw model/user evidence values and technical identifiers are not rewritten. New user-facing strings must have both `en` and `ja` entries and be rendered through the same dictionary. The independent currency control persists `roomledger-currency`; it converts displays, editors, reports, and CSV with a visible indicative 150 JPY/USD rate without changing language or stored evidence.
- `cache/sample-*.json`: original illustrated sample-home responses with explicit origin/model provenance. Live cache keys include a normalized-endpoint hash; mock and live origins are never silently interchangeable. Offline fixture keys use the fixed `FIXTURE_KEY_MODEL`, never `NOSANA_MODEL`, so configuring a live model cannot orphan the committed samples or mint new `cache/sample-*.json` files. Never commit user-upload cache entries, images, credentials, raw endpoint URLs, or base64 logs.

## Verification

Create an isolated virtual environment, install `requirements-dev.txt` and optionally `requirements-daytona.txt`, then run:

```sh
.venv/bin/python -m pytest -q
.venv/bin/python scripts/browser_check.py
.venv/bin/python scripts/check_project.py
```

Browser checks use system Chromium and save review artifacts under ignored `artifacts/`. After any UI change, inspect the desktop and mobile screenshots, not only assertions.

## Invariants

- Never represent local, cache, mock, or demo execution as live sponsor usage. Bundled sample runs must always force local workers, even when Daytona/Nosana credentials are configured; preserve the regression test that forbids sandbox initialization in sample mode.
- With Daytona enabled, decode only in sandboxes. Download merely sanitized JPEG and JSON results.
- One shared GPU limit covers initial detection and high-value refinement. Permits are retained until cancelled background HTTP operations actually finish. One failed room must not cancel other rooms.
- Sanitized remote workspaces are destroyed in `finally`, labelled `app=roomledger`, and constrained by a 30-minute TTL. Deletion uses `wait=True`; accepted-but-unconfirmed deletion is not “destroyed.” Startup sweep must only touch that label and sandboxes at least five minutes old, and must finish before requests are served.
- Preserve stable room/item IDs. Exports and reports must include client-side edits and never silently remove duplicate flags.
- Underlying valuations and depreciation inputs remain USD; indicative shopping source prices remain JPY. Never rewrite stored evidence for display preferences. USD/JPY display conversion must exchange through `formatMoney`, label the indicative 150 JPY/USD rate, keep CSV currency metadata explicit, and remain independent from language.
- Fingerprint text belongs beside its matching sanitized photograph.
- SSE progress must stream while rooms are still running; the stream loop waits on the next event or a finished room, never on room completion alone.
- Never send the Nosana account `NOSANA_API_KEY` to a dedicated deployment endpoint; it runs on a third-party host.
- When changing these structures, contracts, tests, or workflows, update this guide and the README in the same change.
