# Clear Dispatch

**Human-in-the-loop emergency dispatch support for wildfire surge events.**

Four AI agents work silently behind a 911 dispatcher — classifying calls, dispatching units, and generating voice briefings — so the dispatcher stays in control even when the phones don't stop ringing.

> **Core principle: The AI never speaks to callers. The dispatcher is always the human interface.**

Built at **HackDavis 2026**.

---

## The Problem

During a major wildfire, a single 911 dispatch center can receive dozens of calls per minute. A human dispatcher can handle one caller at a time. The backlog grows. Triage decisions get made under pressure with incomplete information. Heavy assets get deployed incorrectly.

Clear Dispatch keeps the dispatcher in control while AI handles the coordination layer.

---

## Two Modes

Clear Dispatch operates in one of two modes, switching automatically based on call volume:

**Assisted Mode** — *Tesla Autopilot*
The dispatcher handles calls normally. AI agents run in the background: classifying severity, finding the nearest available unit, and preparing a voice briefing — but the dispatcher owns every decision.

**Surge Mode** — *Waymo*
When call rate exceeds the threshold (default: 10 calls/min), agents take over triage and routing automatically. The dispatcher monitors the queue, approves heavy asset dispatches, and can override back to Assisted at any time.

The system transitions back to Assisted Mode after 120 continuous seconds below the surge threshold.

---

## Four Agents

| Agent | Role | Technology |
|---|---|---|
| **MONITOR** | Watches call volume every 5s via sliding 60s window; triggers mode transitions | Python |
| **TRIAGE** | Classifies each call's severity (`CRITICAL`/`URGENT`/`STANDARD`), incident type, and vulnerable-caller flag | Claude Haiku |
| **RESOURCE** | Finds nearest available unit via Haversine distance; manages Protocol HOLD for heavy assets | Python + polling |
| **RELAY** | Generates a concise dispatcher briefing sentence; synthesizes voice audio | Claude Haiku + ElevenLabs TTS |

All four agents broadcast status updates in real time, so the dispatcher sees exactly what each agent is doing at every step.

---

## Quick Start

**Requirements:** Python 3.11+, [`uv`](https://github.com/astral-sh/uv), Node.js 18+, Anthropic API key

### 1. Backend

```bash
cd signal/backend
cp .env.example .env       # fill in ANTHROPIC_API_KEY (required)
uv sync
uvicorn main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok","mode":"ASSISTED"}`

### 2. Frontend

```bash
cd signal/frontend
npm install
npm run dev                 # → http://localhost:5173
```

### 3. Environment Variables

**`signal/backend/.env`**

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | — | Powers TRIAGE and RELAY agents |
| `ELEVENLABS_API_KEY` | No | — | Voice briefings and voice agent; text-only mode if absent |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | ElevenLabs TTS voice ID |
| `SURGE_THRESHOLD` | No | `10` | Calls/min that trigger Surge Mode |

**`signal/frontend/.env`** (create if missing)

```
VITE_WS_URL=ws://localhost:8000/ws
```

---

## Demo Walkthrough

With both services running, follow this sequence:

| Step | Action | What You See |
|---|---|---|
| **1** | Click **Reset** | All state clears; agents return to IDLE; audit trail resets |
| **2** | Click **Start Demo** | 2 calls appear; TRIAGE → RESOURCE → RELAY pipeline fires; agent cards flash; voice briefing plays |
| **3** | Click **Answer Call** | Pick a pre-recorded scenario; live transcript streams in sentence by sentence; LIVE badge appears |
| **4** | Click **End Call** | Full pipeline runs on the live-transcribed call |
| **5** | Click **Trigger Surge** | SURGE banner activates (red, scanline animation); 4 calls auto-triaged and routed simultaneously |
| **6** | Click **Simulate Incoming Call** | ElevenLabs voice agent opens — speak as the caller; transcript appears in the modal |
| **7** | *(auto)* | A heavy asset call triggers **Protocol HOLD** — modal blocks until dispatcher confirms or cancels |
| **8** | Click **Override** | Returns to Assisted Mode; override logged in audit trail |
| **9** | Press **A** | Audit Trail expands — full timestamped log of every agent decision |

**Pause** stops all API spend instantly (simulator off, pipeline blocked). **Resume** restores it.

### Pre-Recorded Scenarios (Assisted Mode)

| ID | Scenario |
|---|---|
| `tesla_accident` | Multi-vehicle accident, Highway 99, airbag deployed |
| `wildfire_evacuation` | Family of 4 trapped, fire approaching |
| `structure_fire` | Apartment fire, multiple floors, people on balconies |
| `medical_elderly` | 78-year-old collapsed, possible stroke |
| `hazmat_spill` | Chemical tanker overturned near an elementary school |

---

## Architecture

```
signal/
├── backend/                FastAPI + Python 3.11 (uv-managed)
│   ├── main.py             Entry point — lifespan, CORS, WebSocket, /audio static mount
│   ├── state.py            Single in-memory source of truth (never define state elsewhere)
│   ├── logger.py           In-memory log ring buffer (500 entries); redacts API keys
│   ├── simulator.py        Poisson call generator — rate driven by state.simulator_lambda
│   ├── agents/
│   │   ├── monitor.py      Background loop: sliding window → mode transitions
│   │   ├── triage.py       Claude Haiku → severity · incident_type · vulnerable
│   │   ├── resource.py     Haversine nearest unit · Protocol HOLD for heavy assets
│   │   └── relay.py        Claude Haiku → briefing text · ElevenLabs TTS → audio/{id}.mp3
│   ├── routers/            calls · state · override · hold · demo · logs · live_calls · surge_calls
│   ├── ws/hub.py           ConnectionManager — all WS events go through manager.broadcast()
│   └── data/               park_fire.geojson · resources.json · vulnerability.json · transcripts/
└── frontend/               React 18 + Vite + Tailwind CSS
    └── src/
        ├── types.ts              All TypeScript types (Mode, Severity, WsMessage, AppState…)
        ├── store/reducer.ts      Pure reducer — every WebSocket message type handled here
        ├── hooks/useWebSocket.ts Auto-reconnecting hook (3s retry, StrictMode-safe)
        └── components/           ModeIndicator · CallQueue · AgentCards · MapView ·
                                  BriefingPanel · HoldModal · OverrideButton · AuditTrail ·
                                  DemoControls · SosQrCode · VoiceAgentModal
```

### Agent Pipeline (Per Call)

```
POST /call
  → CALL_ADDED (PENDING broadcast)
  → TRIAGE  (Claude Haiku)  → severity · incident_type · vulnerable flag
  → CALL_ADDED (real severity broadcast)
  → RESOURCE                → nearest unit via Haversine  (ETA = km ÷ 80 × 60 min)
      heavy asset?  → HOLD_REQUIRED  → polls every 2s, max 60s, for dispatcher confirm
      standard?     → UNIT_DISPATCHED immediately
  → RELAY   (Claude Haiku)  → briefing text → ElevenLabs TTS → audio/{id}.mp3
  → BRIEFING_READY + INCIDENT_REPORT broadcast
```

### Real-Time Data Flow

```
Backend ──WebSocket──► reducer.ts ──► useReducer ──► React UI
         JSON events    (pure fn)       (state)
```

Every UI update originates from a WebSocket event broadcast via `ws/hub.py`. There is no polling from the frontend.

### Background Tasks

Two long-running tasks are spawned at startup and cancelled on shutdown:

- **`monitor_loop()`** — runs every 5 seconds; computes call rate over a sliding 60-second window; triggers ASSISTED→SURGE when rate exceeds `surge_threshold`; reverts SURGE→ASSISTED after 120 continuous seconds below threshold.

- **`simulator_loop()`** — generates calls at exponential inter-arrival times parameterized by `state.simulator_lambda["value"]` (default 2.0 calls/min; demo surge sets 15.0). Skips when `state.system_state["paused"]` is `True`.

---

## Protocol HOLD

When the RESOURCE agent selects a heavy asset (`air_tanker`, `heavy_rescue`, `hazmat`), it does not dispatch immediately. Instead:

1. A `HOLD_REQUIRED` event is broadcast — the frontend shows a blocking modal
2. The backend polls `state.hold_queue` every 2 seconds for up to 60 seconds
3. If the dispatcher clicks **Confirm** → the asset is dispatched
4. If the dispatcher clicks **Cancel**, or the 60s window expires → the asset is returned to the pool and the call proceeds without it

This enforces CAL FIRE protocol §4.2 requirements for heavy asset authorization.

---

## Phone SOS (LAN Demo)

In Surge Mode, a QR code appears in the top-right corner of the dispatcher screen. A judge scans it with their phone, speaks directly to the ElevenLabs voice agent, and appears as a live incoming call — complete with GPS coordinates.

### Requirements
- Laptop and phone on the **same Wi-Fi network**
- **Android + Chrome** (iOS Safari blocks microphone access over plain HTTP)
- `ELEVENLABS_API_KEY` set in `signal/backend/.env`

### Setup

```bash
# 1. Find your LAN IP address
ipconfig getifaddr en0   # macOS   → e.g. 192.168.1.42
ip route get 1 | awk '{print $7; exit}'   # Linux

# 2. Start the backend (unchanged)
cd signal/backend && uvicorn main:app --reload --port 8000

# 3. Start the frontend (Vite binds to 0.0.0.0 — accessible on LAN)
cd signal/frontend && npm run dev
# Prints two URLs:
#   Local:   http://localhost:5173/
#   Network: http://192.168.1.42:5173/  ← phone uses this
```

**Demo steps:**
1. Click **Trigger Surge** — SURGE banner + QR code appear
2. Hand phone to a judge — scan the QR code
3. Phone opens `/sos`: tap **SOS**, allow microphone + location
4. Judge speaks to the voice agent; call appears in the Active Calls queue
5. Agent ends call automatically ~15 seconds after its closing line

### ElevenLabs Agent Configuration

Before the demo, configure the agent on the [ElevenLabs dashboard](https://elevenlabs.io):

**Agent ID:** `agent_1701kr8n4kw9fr9aapm59ca3edg8`

1. **Closing line** — replace the default with:
   > "Emergency services have been dispatched to your location. While you wait: [one short situation-appropriate action]. Help is on the way."
2. **Silence timeout** — set to **15 seconds** so the agent ends the session automatically

---

## REST API Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{status, mode}` health check |
| `POST` | `/call` | Ingest a call; run full pipeline async |
| `GET` | `/calls` | Current call queue |
| `GET` | `/state` | Full state snapshot (`mode`, `call_queue`, `resources`, `hold_queue`, `fire_perimeter`) |
| `POST` | `/override` | Force mode → ASSISTED; append override to incident log |
| `POST` | `/confirm-hold` | Approve heavy asset dispatch (`{hold_id}`) |
| `POST` | `/cancel-hold` | Cancel heavy asset dispatch (`{hold_id}`) |
| `POST` | `/call/start-live` | Begin Assisted Mode live call; streams pre-transcribed scenario via WS |
| `POST` | `/call/end-live` | End live call; merge extractions → run pipeline |
| `POST` | `/surge/call/initiate` | Create Surge Mode voice call record; frontend opens voice agent modal |
| `POST` | `/surge/call/complete` | Receive conversation transcript; Claude extracts fields; run pipeline |
| `POST` | `/demo/reset` | Clear all state; reset lambda to 0.1 |
| `POST` | `/demo/start` | Inject 2 normal calls (2s apart) |
| `POST` | `/demo/trigger-surge` | Set SURGE + lambda=15; inject 4 calls (4th forces heavy asset) |
| `POST` | `/demo/pause` | Pause simulator + block pipeline |
| `POST` | `/demo/resume` | Resume simulator + unblock pipeline |
| `GET` | `/logs` | In-memory log buffer (`?level=INFO\|WARNING\|ERROR&limit=200`) |

---

## WebSocket Events

All events flow from backend → frontend over `/ws`. Every message type is handled in `store/reducer.ts`.

| Event | Payload | Frontend Effect |
|---|---|---|
| `DEMO_RESET` | `{timestamp}` | Full state reset |
| `MODE_CHANGE` | `{mode, timestamp}` | Updates header banner; audit log entry |
| `CALL_ADDED` | `{id, severity, zone, vulnerable, incident_type}` | Upserts call card (idempotent) |
| `AGENT_STATUS` | `{agent, status, last_action}` | Updates agent card; triggers flash on RUNNING |
| `UNIT_DISPATCHED` | `{call_id, unit_id, eta_minutes}` | Shows unit info on call card |
| `HOLD_REQUIRED` | `{call_id, unit_id, asset_type, hold_id}` | Opens Protocol HOLD modal |
| `HOLD_RESOLVED` | `{hold_id, action}` | Closes modal if matching hold_id |
| `BRIEFING_READY` | `{call_id, text, audio_url}` | Adds briefing; plays audio (with autoplay fallback) |
| `INCIDENT_REPORT` | `{call_id, report}` | Audit log entry — call archived |
| `CALL_UPDATED` | `{id, transcript_snippet, …fields}` | Streams live transcript + extracted fields into call card |
| `DEMO_PAUSED` | `{timestamp}` | Audit log entry |
| `DEMO_RESUMED` | `{timestamp}` | Audit log entry |

---

## Data

### Resources (`data/resources.json`)

20 units pre-loaded at startup:

| Type | Count | Units |
|---|---|---|
| `engine` | 12 | UNIT-001 – UNIT-012 |
| `personnel` | 4 | UNIT-013 – UNIT-016 |
| `air_tanker` | 2 | UNIT-017, UNIT-018 |
| `heavy_rescue` | 1 | UNIT-019 |
| `hazmat` | 1 | UNIT-020 |

Heavy asset types (`air_tanker`, `heavy_rescue`, `hazmat`) require Protocol HOLD confirmation.

### Vulnerability Zones (`data/vulnerability.json`)

Eight zones across Yolo County with scores from 0 (low) to 1 (high vulnerability). A call is flagged `vulnerable=true` when zone score > 0.6 or the description mentions elderly/disabled/children/assisted living.

| Zone | Score | Flagged |
|---|---|---|
| YL-01 | 0.72 | ⚠ yes |
| YL-02 | 0.45 | no |
| YL-03 | 0.88 | ⚠ yes |
| YL-04 | 0.31 | no |
| YL-05 | 0.63 | ⚠ yes |
| YL-06 | 0.19 | no |
| YL-07 | 0.55 | no |
| YL-08 | 0.77 | ⚠ yes |

### Fire Perimeter (`data/park_fire.geojson`)

GeoJSON boundary for the 2024 Park Fire (Butte/Tehama counties) — rendered on the Leaflet map.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.11, FastAPI, uvicorn |
| Package manager | uv |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Voice | ElevenLabs TTS + Conversational AI |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS + CSS custom properties |
| Maps | Leaflet + CartoDB dark tiles |
| Real-time | WebSocket (native FastAPI ↔ React) |
| State | In-memory (no database — resets on restart or `/demo/reset`) |

---

## Development

### Smoke Test

Requires the backend to be running and `pip install websockets`:

```bash
bash scripts/smoke_test.sh
```

Verifies: health check, state reset, call injection, WebSocket `BRIEFING_READY` delivery, all three `/demo/*` endpoints, and call queue population after surge injection.

### Adding a Pre-Recorded Scenario

1. Create `signal/backend/data/transcripts/{id}.json`:

```json
{
  "id": "scenario_id",
  "title": "Display Name",
  "zone": "YL-01",
  "lat": 38.9,
  "lon": -122.1,
  "incident_type": "fire",
  "sentences": [
    "First sentence the caller says.",
    "Second sentence.",
    "..."
  ]
}
```

2. Add the entry to `TRANSCRIPT_OPTIONS` in `signal/frontend/src/components/DemoControls.tsx`.

Sentences stream at 1.5-second intervals. Claude Haiku runs field extraction every 2 sentences.

### Tuning the Surge Threshold

Set `SURGE_THRESHOLD` in `signal/backend/.env` (default: `10` calls/min). The MONITOR agent evaluates a sliding 60-second window every 5 seconds. After the rate drops below threshold, Surge Mode persists for 120 more seconds before reverting.

For local testing, `/demo/trigger-surge` bypasses the threshold by directly setting mode and lambda.

---

## Hackathon Context

Built at **HackDavis 2026** — UC Davis's annual social-good hackathon.

The scenario is grounded in the **2024 Park Fire** (Butte/Tehama counties, California) — one of the largest recorded wildfires in California history, burning over 400,000 acres. The vulnerability zones, fire perimeter GeoJSON, and unit configurations reflect real Yolo County geography and CAL FIRE resource structures.

**Key design constraints:**
- The AI never communicates directly with callers
- Heavy asset dispatch requires explicit human confirmation every time
- All state is in-memory — no database, no external dependencies, demo-ready on first run
- The dispatcher can override any agent decision at any time
