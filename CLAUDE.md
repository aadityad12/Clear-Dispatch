# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: SIGNAL

Human-in-the-loop emergency dispatch support for wildfire surge events. Four AI agents (MONITOR, TRIAGE, RESOURCE, RELAY) assist a 911 dispatcher — never callers. HackDavis 2026.

## Commands

```bash
# Backend
cd signal/backend && uv sync
uvicorn main:app --reload --port 8000
curl http://localhost:8000/health   # → {"status":"ok","mode":"ASSISTED"}
curl http://localhost:8000/logs     # → in-memory log buffer (call + briefing events)

# Frontend (alongside backend)
cd signal/frontend && npm install && npm run dev   # http://localhost:5173

# Smoke test (backend must be running; pip install websockets required for WS checks)
bash scripts/smoke_test.sh
```

## Architecture

```
signal/
├── backend/              FastAPI + Python 3.11 (uv managed)
│   ├── main.py           Entry point — lifespan, CORS, /ws WebSocket, /audio static mount
│   ├── state.py          Single in-memory source of truth — never define state elsewhere
│   ├── logger.py         In-memory log ring buffer (500 entries); sanitizes API keys before storing
│   ├── simulator.py      Poisson call generator; rate controlled by state.simulator_lambda["value"]
│   ├── agents/           MONITOR, TRIAGE (Claude Haiku), RESOURCE, RELAY (Claude Haiku + ElevenLabs)
│   ├── routers/          calls, state_router, override, hold, demo, logs_router
│   ├── ws/hub.py         ConnectionManager — all WS events go through manager.broadcast(type, payload)
│   └── data/             park_fire.geojson, resources.json, vulnerability.json
└── frontend/             React 18 + Vite + Tailwind CSS
    └── src/
        ├── types.ts              All shared TypeScript types (Mode, Severity, WsMessage, AppState, …)
        ├── store/reducer.ts      Pure reducer — every WS message type handled here, auditLog prepended
        ├── hooks/useWebSocket.ts Auto-reconnecting WS hook (3s retry); StrictMode-safe via isCancelled guard
        └── components/           ModeIndicator, CallQueue, AgentCards, MapView, OverrideButton,
                                  HoldModal, BriefingPanel, AuditTrail, DemoControls
```

### Agent pipeline (per call)

```
POST /call
  → CALL_ADDED (PENDING broadcast)
  → TRIAGE  (Claude Haiku) → severity, incident_type, vulnerable flag
  → CALL_ADDED (real severity broadcast)
  → RESOURCE               → nearest available unit (_haversine distance, ETA = km/80*60)
      heavy asset?  → HOLD_REQUIRED  (polls hold_queue every 2s, max 60s for dispatcher confirm)
      standard?     → UNIT_DISPATCHED immediately
  → RELAY   (Claude Haiku) → briefing text → ElevenLabs TTS if key present → audio/{id}.mp3
  → BRIEFING_READY + INCIDENT_REPORT broadcast
```

### Background tasks (lifespan-managed)

- `monitor_loop()` — every 5s; sliding 60s window on `state.call_timestamps`; ASSISTED→SURGE when rate > threshold, SURGE→ASSISTED after 120s below threshold
- `simulator_loop()` — exponential inter-arrival from `state.simulator_lambda["value"]` calls/min (default 2.0; demo surge sets 15.0)

### State shape (`state.py`)

```python
system_state = { "mode": "ASSISTED", "surge_threshold": 10, "surge_started_at": None, "call_timestamps": [] }
call_queue: list[dict]          # active calls (all fields including briefing_text, unit_id, eta_minutes)
incident_log: list[dict]        # completed audit records (appended by RELAY)
hold_queue: dict[str, dict]     # hold_id → { call_id, unit_id, asset_type, resolved: None|"CONFIRMED"|"CANCELLED" }
simulator_lambda: dict          # {"value": float} — mutated directly by demo endpoints
resources: list[dict]           # loaded from data/resources.json; resource["available"] toggled by RESOURCE agent
vulnerability_data: dict[str, float]   # zone → score; vulnerable flag set when score > 0.6
fire_perimeter: dict            # GeoJSON for MapView
```

### REST endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{status, mode}` |
| POST | `/call` | Ingest a call, run pipeline async |
| GET | `/calls` | Current call queue |
| GET | `/state` | Full system state snapshot |
| POST | `/override` | Force mode → ASSISTED, append override to incident_log |
| POST | `/confirm-hold` | Resolve a HOLD_REQUIRED as CONFIRMED |
| POST | `/cancel-hold` | Resolve a HOLD_REQUIRED as CANCELLED |
| POST | `/demo/reset` | Clear all state; reset lambda to 0.1; broadcast MODE_CHANGE + 4× AGENT_STATUS IDLE |
| POST | `/demo/start` | Inject 2 normal calls (2s apart) |
| POST | `/demo/trigger-surge` | Set SURGE + lambda=15; inject 4 calls (4th has `force_heavy_asset=True`) |
| GET | `/logs` | In-memory log buffer; `?level=INFO\|WARNING\|ERROR&limit=200` |

### Logging

`logger.py` attaches an in-memory handler to the root logger. Only two log lines are emitted per call:
- `CALL [id] zone=… SEVERITY type [VULNERABLE] — triage reasoning` (INFO, from `calls.py` after triage)
- `BRIEFING [id] <briefing sentence>` (INFO, from `relay.py`)

Mode transitions log as WARNING. All `ANTHROPIC_API_KEY` / `ELEVENLABS_API_KEY` values are redacted before storage.

## Shared Contract — Do Not Deviate

| Concern | Value |
|---|---|
| Backend port | `8000` |
| Frontend port | `5173` |
| WebSocket path | `/ws` |
| API proxy | Vite proxies `/api/*` → `http://127.0.0.1:8000` (strips `/api`) |
| Frontend WS env | `VITE_WS_URL=ws://localhost:8000/ws` in `signal/frontend/.env` |

**Exact enum strings** (must match across backend and frontend):
- Mode: `ASSISTED` | `SURGE`
- Severity: `CRITICAL` | `URGENT` | `STANDARD` | `PENDING`
- Agent names: `MONITOR` | `TRIAGE` | `RESOURCE` | `RELAY`
- Agent status: `IDLE` | `RUNNING` | `COMPLETE` | `ERROR`
- Heavy asset types: `air_tanker` | `heavy_rescue` | `hazmat`

**WebSocket messages** (backend → frontend, all via `manager.broadcast`):
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

**`signal/backend/.env`**

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | TRIAGE + RELAY agents |
| `ELEVENLABS_API_KEY` | No | — | Text-only mode if absent |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | |
| `SURGE_THRESHOLD` | No | `10` | calls/min to trigger Surge Mode |

**`signal/frontend/.env`** (create if missing)
```
VITE_WS_URL=ws://localhost:8000/ws
```

## Frontend data flow

1. `useWebSocket` receives raw WS text → parses as `WsMessage` → calls `onMessage`
2. `App.tsx` dispatches `{ type: 'WS_MESSAGE', message }` to `useReducer`
3. `reducer.ts` handles every message type — updates `calls`, `agents`, `activeHold`, `briefings`, `auditLog`
4. `BRIEFING_READY` also triggers `new Audio(audio_url).play()` in `App.tsx`; autoplay block falls back to a manual play button
5. Agent card flash animation: `App.tsx` tracks previous agent statuses with `useRef`, sets a 600ms flash flag when any agent transitions into `RUNNING`

## Demo flow (for judges)

Reset → Start Demo (2 normal calls, ASSISTED) → Trigger Surge (SURGE banner, 4 auto-triaged calls) → voice briefing or text fallback → Protocol HOLD modal on heavy asset → dispatcher confirms → Override → Audit Trail.

## Optional Features (post-MVP, implement only if time permits)

<!-- These were scoped and designed during /grill-me but deferred to keep the demo MVP tight. -->
<!-- To implement one, tell Claude: "implement the optional feature: <name>" -->

### 1. Assisted Mode — Live Caller Transcription
Dispatcher clicks "Answer Call" → browser MediaRecorder captures audio in 4s chunks → `POST /call/audio-chunk` → ElevenLabs Scribe STT → incremental Claude Haiku extraction → `CALL_UPDATED` WS event → live-updating info card in CallQueue with LIVE badge and transcript snippet. Ends with `POST /call/end-live` which feeds into the existing resource + relay pipeline.
- New state: `live_transcripts: dict[str,str]`, `live_extractions: dict[str,dict]`
- New endpoints: `POST /call/start-live`, `POST /call/audio-chunk`, `POST /call/end-live`
- New WS event: `CALL_UPDATED { id, final, transcript_snippet, severity?, incident_type?, location?, one_liner?, caller_status?, people_affected?, hazards?, structure_type? }`
- Button visible only in ASSISTED mode

### 2. Surge Mode — ElevenLabs Conversational Voice Agent
When in SURGE, an autonomous ElevenLabs Conversational AI agent answers overflow calls. Browser uses `@11labs/client` SDK directly (no backend WS proxy needed). Backend endpoints `POST /surge/call/initiate` and `POST /surge/call/complete` create call records and feed collected data into the existing triage/resource/relay pipeline. Requires `ELEVENLABS_SURGE_AGENT_ID` and `ELEVENLABS_SURGE_VOICE_ID` env vars configured in the ElevenLabs dashboard first.
- New env: `ELEVENLABS_SURGE_AGENT_ID`, `ELEVENLABS_SURGE_VOICE_ID` (backend + frontend)
- "Simulate Incoming Call" button in DemoControls, visible only in SURGE mode
- Expandable CallQueue cards with compact/expanded views; CRITICAL or in_danger cards auto-expand

## Agents & Skills Available

- **`Ubiquitous` agent**: run whenever new technology or domain terms are introduced — extracts DDD-style glossary to `UBIQUITOUS_LANGUAGE.md`
- **`/grill-me` skill**: stress-test a plan or design before implementing
