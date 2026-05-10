# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: SIGNAL

Human-in-the-loop emergency dispatch support system for wildfire surge events. Four AI agents (MONITOR, TRIAGE, RESOURCE, RELAY) assist a 911 dispatcher — never callers. This is a HackDavis 2026 project.

**This session is Person 2 — frontend owner.** Responsible for all GitHub issues labeled `[Frontend]` (issues #9–15 in `aadityad12/HackDavis26`).

## Commands

```bash
# Frontend (Person 2's domain)
cd signal/frontend && npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build

# Backend (Person 1's domain — must be running for WS/API)
cd signal/backend && uv sync
uvicorn main:app --reload --port 8000
```

## Shared Contract — Do Not Deviate

| Concern | Value |
|---|---|
| Backend port | `8000` |
| Frontend port | `5173` |
| WebSocket path | `/ws` |
| API proxy | Vite proxies `/api/*` → `http://localhost:8000` (strips `/api` prefix) |
| WS env var | `VITE_WS_URL=ws://localhost:8000/ws` in `signal/frontend/.env` |

**Enum values** (exact strings — backend and frontend must match):
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

**REST endpoints** (frontend calls via `/api` proxy):
```
POST /api/override
POST /api/confirm-hold   body: { hold_id }
POST /api/cancel-hold    body: { hold_id }
POST /api/demo/start
POST /api/demo/trigger-surge
POST /api/demo/reset
```

## Frontend Architecture

**Stack**: React 18 + Vite 6 + TypeScript 5 + Tailwind 3 + Leaflet 1.9 (vanilla, not react-leaflet)

**State flow**: `useWebSocket` hook → dispatches `Action` → `useReducer(reducer, initialState)` in `App.tsx` → props to components. The reducer (`src/store/reducer.ts`) is pure — no side effects. All WS message handling lives there.

**Layout**: Full-viewport flex column — `ModeIndicator` (fixed top banner) → 3-column grid (CallQueue | MapView | AgentCards+BriefingPanel) → `AuditTrail` (collapsible bottom) → `DemoControls` (fixed bottom bar). `HoldModal` is a `z-50` fullscreen overlay when `activeHold !== null`. `OverrideButton` is fixed-position, only visible in SURGE mode.

**Visual design**: No dark mode, no gradients, no heavy shadows. Background `#F8FAFC`, panels white with `border border-slate-200`. Primary blue `#1D4ED8`, SURGE red `#DC2626`. Font: Inter. Monospace only for IDs and timestamps.

## Implementation Gotchas

- **Leaflet CSS**: import `leaflet/dist/leaflet.css` in `src/index.css`, not in the component — marker icons break otherwise.
- **Leaflet map height**: container div must have `style={{ height: '400px' }}` or the map won't render.
- **Leaflet double-init**: clean up the map instance on unmount in the `useEffect` return.
- **Audio autoplay**: browsers block `audio.play()` without prior user interaction — wrap in `try/catch` and show a "Click to play briefing" fallback button.
- **`CALL_ADDED` deduplication**: this message fires twice per call (once as `PENDING`, once with real severity). The reducer deduplicates by `id` — components just render `state.calls`.
- **HoldModal**: no close-on-backdrop-click — dispatcher must explicitly confirm or cancel.
- **WS reconnect**: `useWebSocket` retries every 3s automatically. `ModeIndicator` shows connection status.

## Demo Flow (for judges)

Reset → Start Demo (2 normal calls) → Trigger Surge (SURGE banner + 4 auto-triaged calls) → ElevenLabs voice briefing (or text fallback) → HOLD modal on heavy asset → Override → show Audit Trail.

## GitHub Issues Ownership

All `[Frontend]` issues (#9–15) in `aadityad12/HackDavis26`:
- #9 Project scaffold (Vite + React + Tailwind + types + reducer)
- #10 WebSocket hook with auto-reconnect
- #11 ModeIndicator and AgentCards
- #12 CallQueue
- #13 MapView (Leaflet + Park Fire perimeter)
- #14 OverrideButton and HoldModal
- #15 BriefingPanel, AuditTrail, DemoControls

## Agents & Skills Available

- `Ubiquitous` agent: run whenever new technology or domain terms are introduced — extracts DDD-style glossary to `UBIQUITOUS_LANGUAGE.md`
- `grill-me` skill (`/grill-me`): stress-test a plan or design before implementing
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
