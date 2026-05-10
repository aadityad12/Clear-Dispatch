# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project: SIGNAL

Human-in-the-loop emergency dispatch support system for wildfire surge events. Four AI agents (MONITOR, TRIAGE, RESOURCE, RELAY) assist a 911 dispatcher. **The AI never speaks to callers — only to the dispatcher.**

## Role Assignment

- **Person 1 (us)** — backend: `signal/backend/` — implement and own the FastAPI server, agents, WebSocket hub
- Person 2 — frontend: `signal/frontend/` — React 18 + Vite + Tailwind dashboard
- Person 3 — integration: CORS wiring, demo endpoints, smoke test, README

## Commands

### Backend (Person 1)

```bash
cd signal/backend
uv sync
uvicorn main:app --reload --port 8000

# Health check
curl http://localhost:8000/health
```

### Frontend (Person 2)

```bash
cd signal/frontend
npm install
npm run dev   # http://localhost:5173
```

### Smoke test (Person 3)

```bash
bash scripts/smoke_test.sh
```

### Environment setup

```bash
# Backend
cp signal/backend/.env.example signal/backend/.env
# Set ANTHROPIC_API_KEY in signal/backend/.env

# Frontend
echo "VITE_WS_URL=ws://localhost:8000/ws" > signal/frontend/.env
```

## Architecture

```
signal/
├── backend/              FastAPI + Python 3.11 (uv managed)
│   ├── main.py           App entry point, lifespan, CORS, /ws endpoint
│   ├── state.py          Single source of truth — all in-memory state lives here
│   ├── simulator.py      Poisson call generator background task
│   ├── agents/           MONITOR, TRIAGE, RESOURCE, RELAY
│   ├── routers/          calls, state_router, override, hold, demo
│   ├── ws/hub.py         ConnectionManager — all broadcasts go through manager.broadcast()
│   └── data/             park_fire.geojson, resources.json, vulnerability.json
└── frontend/             React 18 + Vite + Tailwind CSS
    └── src/
        ├── types.ts       All shared TypeScript types
        ├── store/reducer.ts  Pure reducer handling every WS message type
        ├── hooks/useWebSocket.ts  Auto-reconnecting WS hook (3s retry)
        └── components/   ModeIndicator, CallQueue, AgentCards, MapView,
                          OverrideButton, HoldModal, BriefingPanel, AuditTrail, DemoControls
```

### State architecture

All state lives in `state.py`. Import it everywhere — never define state in other modules. State is entirely in-memory; it resets on server restart or `POST /demo/reset`.

### Agent pipeline (per incoming call)

```
POST /call → CALL_ADDED (severity: PENDING)
           → TRIAGE agent   [Claude Haiku → severity + incident_type + vulnerable]
           → CALL_ADDED (real severity)
           → RESOURCE agent [find nearest available unit → ETA]
               → heavy asset (air_tanker/heavy_rescue/hazmat): HOLD_REQUIRED → wait ≤60s for human confirm
               → standard asset: UNIT_DISPATCHED immediately
           → RELAY agent    [Claude Haiku → dispatcher briefing text → ElevenLabs TTS optional]
           → BRIEFING_READY + INCIDENT_REPORT
```

### Background tasks (started in `main.py` lifespan)

- `monitor_loop()` — every 5s: sliding 60s window on call timestamps, switches ASSISTED ↔ SURGE
- `simulator_loop()` — Poisson call generator at `simulator_lambda["value"]` calls/min

## Shared Contract — Must Not Deviate

### Ports

| Service | Port |
|---|---|
| Backend (FastAPI) | `8000` |
| Frontend (Vite) | `5173` |
| WebSocket path | `/ws` |

### Enum values

| Concept | Values |
|---|---|
| Mode | `ASSISTED` \| `SURGE` |
| Severity | `CRITICAL` \| `URGENT` \| `STANDARD` |
| Agent names | `MONITOR` \| `TRIAGE` \| `RESOURCE` \| `RELAY` |
| Agent status | `IDLE` \| `RUNNING` \| `COMPLETE` \| `ERROR` |
| Heavy asset types | `air_tanker` \| `heavy_rescue` \| `hazmat` |

### REST API

Frontend proxies `/api/*` → `http://localhost:8000` (strips `/api` prefix).

| Method | Path | Owner |
|---|---|---|
| `POST` | `/call` | Person 1 |
| `GET` | `/calls` | Person 1 |
| `GET` | `/state` | Person 1 |
| `POST` | `/override` | Person 1 |
| `POST` | `/confirm-hold` | Person 1 |
| `POST` | `/cancel-hold` | Person 1 |
| `POST` | `/demo/start` | Person 3 fills stub |
| `POST` | `/demo/trigger-surge` | Person 3 fills stub |
| `POST` | `/demo/reset` | Person 3 fills stub |
| `WS` | `/ws` | Person 1 |
| `GET` | `/health` | Person 1 |

### WebSocket message schema (backend produces, frontend consumes)

```json
{ "type": "MODE_CHANGE",     "payload": { "mode": "SURGE|ASSISTED", "timestamp": "ISO8601" } }
{ "type": "CALL_ADDED",      "payload": { "id": "str", "severity": "CRITICAL|URGENT|STANDARD", "zone": "str", "vulnerable": true, "incident_type": "str" } }
{ "type": "AGENT_STATUS",    "payload": { "agent": "MONITOR|TRIAGE|RESOURCE|RELAY", "status": "IDLE|RUNNING|COMPLETE|ERROR", "last_action": "str" } }
{ "type": "UNIT_DISPATCHED", "payload": { "call_id": "str", "unit_id": "str", "eta_minutes": 0 } }
{ "type": "HOLD_REQUIRED",   "payload": { "call_id": "str", "unit_id": "str", "asset_type": "str", "hold_id": "str" } }
{ "type": "HOLD_RESOLVED",   "payload": { "hold_id": "str", "action": "CONFIRMED|CANCELLED" } }
{ "type": "BRIEFING_READY",  "payload": { "call_id": "str", "text": "str", "audio_url": "str|null" } }
{ "type": "INCIDENT_REPORT", "payload": { "call_id": "str", "report": {} } }
```

## Critical Implementation Rules

1. **Use `claude-haiku-4-5-20251001`** for all Claude calls (TRIAGE and RELAY). Never use a larger model.
2. **Anthropic async client only** — never block the event loop. Use `await asyncio.to_thread()` if needed.
3. **ElevenLabs must never crash the pipeline** — wrap all TTS calls in `try/except`; fall back to `audio_url = None`.
4. **RESOURCE agent must only select from `state.resources`** — never invent units.
5. **Protocol HOLD is mandatory** — heavy assets (`air_tanker`, `heavy_rescue`, `hazmat`) must pause and wait for dispatcher confirmation before dispatching.
6. **Zone is `vulnerable: true` if `vulnerability_data[zone] > 0.6`**.
7. **CORS** is pre-configured for `http://localhost:5173` only.

## Environment Variables

### `signal/backend/.env`

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | TRIAGE + RELAY agents |
| `ELEVENLABS_API_KEY` | No | — | Text-only mode if absent |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | |
| `SURGE_THRESHOLD` | No | `10` | calls/min to trigger Surge Mode |

## Demo Run Order (for judges)

1. Reset → Start Demo (2 normal calls, ASSISTED mode)
2. Trigger Surge → SURGE banner, 4 calls auto-triaged
3. HOLD modal fires for heavy asset call — dispatcher must confirm
4. Override → returns to ASSISTED
5. Expand Audit Trail → full timestamped log
