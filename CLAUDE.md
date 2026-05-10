# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: SIGNAL

Human-in-the-loop emergency dispatch support system for wildfire surge events. Four AI agents (MONITOR, TRIAGE, RESOURCE, RELAY) assist a 911 dispatcher — never callers. HackDavis 2026.

**This session is Person 3 — integration owner.** Responsible for all GitHub issues labeled `[Integration]` (issues #16–19 in `aadityad12/HackDavis26`).

| Issue | Deliverable | Status |
|---|---|---|
| #16 | `signal/backend/routers/demo.py` — full demo flow endpoints | stub exists, needs implementation |
| #17 | CORS, static audio mount, `signal/frontend/.env` | CORS + audio mount already in `main.py` — verify `.env` |
| #18 | Root `README.md` — full setup and run guide | needs creation |
| #19 | `scripts/smoke_test.sh` — end-to-end pipeline verification | needs creation |

## Commands

```bash
# Backend (must be running for integration work)
cd signal/backend && uv sync
uvicorn main:app --reload --port 8000
curl http://localhost:8000/health   # → {"status": "ok", "mode": "ASSISTED"}

# Frontend (run alongside backend)
cd signal/frontend && npm install && npm run dev   # http://localhost:5173

# Smoke test (Person 3's deliverable)
bash scripts/smoke_test.sh   # requires backend + pip install websockets
```

## Architecture

```
signal/
├── backend/              FastAPI + Python 3.11 (uv managed)
│   ├── main.py           App entry, lifespan (loads data, starts monitor+simulator tasks), CORS, /ws, /audio mount
│   ├── state.py          Single source of truth — all in-memory state; never define state elsewhere
│   ├── simulator.py      Poisson call generator background task
│   ├── agents/           MONITOR (volume→mode), TRIAGE (Claude Haiku→severity), RESOURCE (dispatch), RELAY (briefing+TTS)
│   ├── routers/          calls.py, state_router.py, override.py, hold.py, demo.py ← Person 3 owns demo.py
│   ├── ws/hub.py         ConnectionManager — all WS broadcasts go through manager.broadcast(type, payload)
│   └── data/             park_fire.geojson, resources.json, vulnerability.json
└── frontend/             React 18 + Vite + Tailwind CSS
    └── src/
        ├── types.ts, store/reducer.ts, hooks/useWebSocket.ts
        └── components/   ModeIndicator, CallQueue, AgentCards, MapView, OverrideButton,
                          HoldModal, BriefingPanel, AuditTrail, DemoControls
```

### Agent pipeline (per call)

```
POST /call → CALL_ADDED (PENDING) → TRIAGE → CALL_ADDED (real severity)
           → RESOURCE → heavy asset? → HOLD_REQUIRED (wait ≤60s for confirm) : UNIT_DISPATCHED
           → RELAY → BRIEFING_READY + INCIDENT_REPORT
```

### Background tasks (lifespan-managed)

- `monitor_loop()` — every 5s, sliding 60s window on `state.call_timestamps`, switches ASSISTED ↔ SURGE
- `simulator_loop()` — Poisson generator at `state.simulator_lambda["value"]` calls/min (default 2.0, surge 15.0)

### State shape (`state.py`)

```python
system_state = { "mode": "ASSISTED", "surge_threshold": 10, "surge_started_at": None, "call_timestamps": [] }
call_queue: list[dict]          # active calls
incident_log: list[dict]        # completed incidents
hold_queue: dict[str, dict]     # hold_id → hold record
simulator_lambda: dict          # {"value": float}
resources: list[dict]           # loaded from data/resources.json
vulnerability_data: dict[str, float]   # zone → score; vulnerable if > 0.6
fire_perimeter: dict            # GeoJSON
```

## Implementing `routers/demo.py` (Issue #16)

The stub at `signal/backend/routers/demo.py` needs three endpoints. Import pattern to use:

```python
from state import system_state, call_queue, incident_log, hold_queue, simulator_lambda, resources
from ws.hub import manager
from routers.calls import process_call   # call internal handler directly, never HTTP-to-self
```

Key behaviors:
- **`/demo/reset`**: clear all lists/dicts, reset `simulator_lambda["value"] = 2.0`, re-mark all `resources[n]["available"] = True`, broadcast `MODE_CHANGE` (ASSISTED) and four `AGENT_STATUS` (IDLE) messages.
- **`/demo/start`**: inject 2 normal calls via `await process_call(call_data)` with `await asyncio.sleep(2)` between them.
- **`/demo/trigger-surge`**: set `system_state["mode"] = "SURGE"`, `simulator_lambda["value"] = 15.0`, broadcast `MODE_CHANGE`, then inject 4 calls. The 4th call should pass `"force_heavy_asset": True` — `process_call` already pops this flag and stores it on the call record, which RESOURCE uses to force a heavy asset.

## Shared Contract — Do Not Deviate

| Concern | Value |
|---|---|
| Backend port | `8000` |
| Frontend port | `5173` |
| WebSocket path | `/ws` |
| API proxy | Vite proxies `/api/*` → `http://localhost:8000` (strips `/api`) |
| Frontend WS env | `VITE_WS_URL=ws://localhost:8000/ws` in `signal/frontend/.env` |

**Enum values** (exact strings — must match across backend and frontend):
- Mode: `ASSISTED` | `SURGE`
- Severity: `CRITICAL` | `URGENT` | `STANDARD` | `PENDING`
- Agent names: `MONITOR` | `TRIAGE` | `RESOURCE` | `RELAY`
- Agent status: `IDLE` | `RUNNING` | `COMPLETE` | `ERROR`
- Heavy asset types: `air_tanker` | `heavy_rescue` | `hazmat`

**WebSocket messages** (backend → frontend):
```
MODE_CHANGE     { mode, timestamp }
CALL_ADDED      { id, severity, zone, vulnerable, incident_type }
AGENT_STATUS    { agent, status, last_action }
UNIT_DISPATCHED { call_id, unit_id, eta_minutes }
HOLD_REQUIRED   { call_id, unit_id, asset_type, hold_id }
HOLD_RESOLVED   { hold_id, action: "CONFIRMED"|"CANCELLED" }
BRIEFING_READY  { call_id, text, audio_url }
INCIDENT_REPORT { call_id, report }
```

## Environment Variables

### `signal/backend/.env`

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | TRIAGE + RELAY agents |
| `ELEVENLABS_API_KEY` | No | — | Text-only mode if absent |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | |
| `SURGE_THRESHOLD` | No | `10` | calls/min to trigger Surge Mode |

### `signal/frontend/.env`

```
VITE_WS_URL=ws://localhost:8000/ws
```

## Demo Flow (for judges)

Reset → Start Demo (2 normal calls, ASSISTED) → Trigger Surge (SURGE banner + 4 auto-triaged calls) → ElevenLabs voice briefing or text fallback → HOLD modal on heavy asset → dispatcher confirms → Override → Audit Trail.

## Agents & Skills Available

- **`Ubiquitous` agent**: run whenever new technology or domain terms are introduced — extracts DDD-style glossary to `UBIQUITOUS_LANGUAGE.md`
- **`/grill-me` skill**: stress-test a plan or design before implementing
