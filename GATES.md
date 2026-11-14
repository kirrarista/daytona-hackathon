# Gates: RoomLedger MVP

Scope: verifiable offline product, production-ready sponsor adapters, reports, and demo assets

- [ ] G1: sanitization, inference parsing, scoring, edits-safe exports, and the complete SSE pipeline pass automated tests
  CHECK: .venv/bin/python -m pytest -q
  EXPECT: passed
  EVIDENCE: pending

- [ ] G2: the six-room sample home works in a real browser with inventory, refinement, quake mode, Japanese, editing, report, CSV, and responsive layout
  CHECK: .venv/bin/python scripts/browser_check.py
  EXPECT: ROOMLEDGER_BROWSER_OK
  EVIDENCE: pending

- [ ] G3: bundled samples, pre-cached model responses, setup documentation, sponsor honesty, and the requested architecture are present and internally consistent
  CHECK: .venv/bin/python scripts/check_project.py
  EXPECT: ROOMLEDGER_PROJECT_OK
  EVIDENCE: pending

- [ ] G4: real Daytona and Nosana are verified with real room photos and all remote sandboxes are confirmed deleted
  EVIDENCE: blocked — DAYTONA_API_KEY, NOSANA_URL, NOSANA_API_KEY, and real photos were not supplied; no live success will be claimed

- [ ] G5: a backup recording demonstrates the full offline sample-home demo flow
  EVIDENCE: pending
