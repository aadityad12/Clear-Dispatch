# SIGNAL — Team Start Here

Welcome to HackDavis 2026. This file is your orientation. Read it before touching any code.

## What We're Building

**SIGNAL** — a human-in-the-loop emergency dispatch support system for wildfire surge events. Four AI agents assist a 911 dispatcher. The AI never speaks to callers — only to the dispatcher. See [GitHub Issue #1](https://github.com/aadityad12/HackDavis26/issues/1) for the full PRD.

---

## Pick Up Your Prompt

| You are | Pick up | Start time |
|---|---|---|
| **Person 1** — backend | `PROMPT_A_BACKEND.md` | Now |
| **Person 2** — frontend | `PROMPT_B_FRONTEND.md` | Now (parallel with Person 1) |
| **Person 3** — integration | `PROMPT_C_INTEGRATION.md` | After Person 1 has backend running (~4–6h) |

Open your prompt file and paste its entire contents into a new Claude Code session in your working directory. Let Claude implement the code, then run it.

---

## Shared Contract — Everyone Must Respect This

All three implementations must agree on the following values exactly.

### Ports

| Service | Port |
|---|---|
| Backend (FastAPI) | `8000` |
| Frontend (Vite) | `5173` |
| WebSocket path | `/ws` |

### Enum Values

| Concept | Values |
|---|---|
| Mode | `ASSISTED` \| `SURGE` |
| Triage severity | `CRITICAL` \| `URGENT` \| `STANDARD` |
| Agent names | `MONITOR` \| `TRIAGE` \| `RESOURCE` \| `RELAY` |
| Agent status | `IDLE` \| `RUNNING` \| `COMPLETE` \| `ERROR` |
| Heavy asset types | `air_tanker` \| `heavy_rescue` \| `hazmat` |
| Surge threshold env var | `SURGE_THRESHOLD` (default: `10` calls/min) |

### WebSocket Message Schema (canonical)

Frontend consumes these. Backend produces them. Do not deviate.

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

### REST API Endpoints (backend owns, frontend calls)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/call` | Inject a new call |
| `GET` | `/calls` | List active call queue |
| `GET` | `/state` | Full system state snapshot |
| `POST` | `/override` | Dispatcher override → return to ASSISTED |
| `POST` | `/confirm-hold` | Confirm a HOLD dispatch |
| `POST` | `/cancel-hold` | Cancel a HOLD dispatch |
| `POST` | `/demo/start` | Begin scripted demo (2 normal calls) |
| `POST` | `/demo/trigger-surge` | Force SURGE + inject 4 calls |
| `POST` | `/demo/reset` | Reset all state |
| `WS` | `/ws` | WebSocket connection |

Frontend proxies all `/api/*` → `http://localhost:8000` (strip `/api` prefix). So `POST /api/override` → `POST http://localhost:8000/override`.

---

## Repo Layout

```
HackDavis26/
├── signal/
│   ├── backend/        ← Person 1
│   └── frontend/       ← Person 2
├── scripts/
│   └── smoke_test.sh   ← Person 3
├── README.md           ← Person 3 fills in
├── PROMPT_A_BACKEND.md
├── PROMPT_B_FRONTEND.md
├── PROMPT_C_INTEGRATION.md
└── TEAM_START_HERE.md  ← this file
```

---

## Startup Order

```
1. Person 1: cd signal/backend && uv sync && uvicorn main:app --reload --port 8000
2. Person 3: add CORS to main.py (after Person 1 is running)
3. Person 2: cd signal/frontend && npm install && npm run dev
4. Open http://localhost:5173 — should show ASSISTED mode dashboard
```

---

## Demo Run Order (for judges)

```
1. Click "Reset"           → clears all state
2. Click "Start Demo"      → 2 normal calls appear, agents assist
3. Click "Trigger Surge"   → SURGE banner activates, agents auto-triage 4 calls
4. Watch ElevenLabs voice briefing fire (if key present) or text briefing
5. Heavy asset call → HOLD modal blocks, wait for dispatcher confirmation
6. Click "Override"        → returns to ASSISTED mode
7. Show audit trail        → full timestamped log of all agent actions
```

---

## Environment Variables

Create `signal/backend/.env` (copy from `.env.example`):

```
ANTHROPIC_API_KEY=your_key_here
ELEVENLABS_API_KEY=          # optional — text fallback if absent
SURGE_THRESHOLD=10           # calls/min to trigger surge mode
```

Create `signal/frontend/.env`:

```
VITE_WS_URL=ws://localhost:8000/ws
```

---

## Core Safety Rule

> The AI never speaks to, or communicates with, the person in crisis.
> The dispatcher is always the human interface between callers and the emergency response system.

This is not a feature — it is a design constraint. Nothing in the code should send any message to a simulated caller.
