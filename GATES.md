# Gates: RoomLedger MVP

Scope: verifiable offline product, production-ready sponsor adapters, reports, and demo assets

- [x] G1: sanitization, inference parsing, scoring, edits-safe exports, and the complete SSE pipeline pass automated tests
  CHECK: .venv/bin/python -m pytest -q && .venv/bin/python -c "print('ROOMLEDGER_TESTS_OK')"
  EXPECT: ROOMLEDGER_TESTS_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=f4590877bb0f0ebcc6e41ff5a02a347ac273a1df86082b9f844ac8621f9d406c; exit=0; EXPECT=matched; output-sha256=06aaa5f0053d370087d7ebabd6cdcbfc3b2df876c6dc9b20a5fec397f08d5f24; output-bytes=654; shell=/bin/sh; cwd=/home/cmasters/Desktop/Computer_Science_Files/WebAppDev/RoomLedger; path=ca517cce621c/41 entries

- [x] G2: the six-room sample home works in a real browser with inventory, refinement, quake mode, Japanese, editing, report, CSV, and responsive layout
  CHECK: .venv/bin/python scripts/browser_check.py
  EXPECT: ROOMLEDGER_BROWSER_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=d252b68f7e320ad071a4724e8fa02419f0540018197e20db50a26916556ca5eb; exit=0; EXPECT=matched; output-sha256=3856154ce960897a6ad09984d488fb02e500d276703e1687955ca71332ce93ec; output-bytes=104; shell=/bin/sh; cwd=/home/cmasters/Desktop/Computer_Science_Files/WebAppDev/RoomLedger; path=ca517cce621c/41 entries

- [x] G3: bundled samples, pre-cached model responses, setup documentation, sponsor honesty, and the requested architecture are present and internally consistent
  CHECK: .venv/bin/python scripts/check_project.py
  EXPECT: ROOMLEDGER_PROJECT_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=7cc3b5310eb4c16f022ec77910eab9197557ca926babd42e8cdc280fa7024c6a; exit=0; EXPECT=matched; output-sha256=3f0b0ef96d8e7cbd978982a102601fa5e15a198fdd8781914d14afaa08014539; output-bytes=99; shell=/bin/sh; cwd=/home/cmasters/Desktop/Computer_Science_Files/WebAppDev/RoomLedger; path=ca517cce621c/41 entries

- [ ] G4: real Daytona and Nosana are verified with real room photos and all remote sandboxes are confirmed deleted
  EVIDENCE: blocked — DAYTONA_API_KEY, NOSANA_URL, NOSANA_API_KEY, and real photos were not supplied; no live success will be claimed

- [x] G5: a backup recording demonstrates the full offline sample-home demo flow
  CHECK: .venv/bin/python scripts/check_recording.py
  EXPECT: ROOMLEDGER_RECORDING_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=0221c4f5c15bf7764e6a16729d9de953024fc9ef18431e2734e5a928753871a8; exit=0; EXPECT=matched; output-sha256=e46d3a2d75421ba3ebf402f40e20af424717dc870aeeea0db6e614429fcb3068; output-bytes=84; shell=/bin/sh; cwd=/home/cmasters/Desktop/Computer_Science_Files/WebAppDev/RoomLedger; path=ca517cce621c/41 entries

ABANDON: G4 no sponsor credentials or real photographs were supplied; SDK adapters and verification tooling are complete, but live verification requires a deployment handoff
