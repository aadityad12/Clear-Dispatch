# SIGNAL — Surge-Intelligent Guard Network for Alert & Logistics

Human-in-the-loop emergency dispatch support for wildfire surge events. Built at HackDavis 2026.

> **The AI never speaks to callers. The dispatcher is always the human interface.**

## What It Does

SIGNAL assists 911 dispatchers during wildfire emergencies. Four AI agents run continuously in the background:

| Agent | Role |
|---|---|
| **MONITOR** | Watches call volume every 5s — switches between Assisted and Surge mode |
| **TRIAGE** | Classifies each call's severity (`CRITICAL` / `URGENT` / `STANDARD`) and incident type |
| **RESOURCE** | Selects the nearest available unit and dispatches it — or raises a Protocol HOLD for heavy assets |
| **RELAY** | Generates a plain-English dispatcher briefing and optional ElevenLabs voice audio |

In **Assisted Mode**, agents assist silently. When call volume crosses the surge threshold, the system enters **Surge Mode** and agents begin triaging and routing automatically — but the dispatcher can override any decision at any time.

Heavy assets (`air_tanker`, `heavy_rescue`, `hazmat`) always require explicit dispatcher confirmation before dispatch (Protocol HOLD).

## Quick Start

### Requirements

- Python 3.11+ and [`uv`](https://github.com/astral-sh/uv) (`pip install uv`)
- Node.js 18+
- An Anthropic API key

### 1. Backend

```bash
cd signal/backend
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY (required)
uv sync
uvicorn main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok","mode":"ASSISTED"}`

### 2. Frontend

```bash
cd signal/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 3. Environment Variables

**`signal/backend/.env`**

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Powers TRIAGE and RELAY agents |
| `ELEVENLABS_API_KEY` | No | — | Voice briefings; text-only mode if absent |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | ElevenLabs voice ID |
| `SURGE_THRESHOLD` | No | `10` | Calls/min that trigger Surge Mode |

**`signal/frontend/.env`** (create if missing)

```
VITE_WS_URL=ws://localhost:8000/ws
```

## Demo (for judges)

With both backend and frontend running:

1. Click **Reset** — clears all state to a clean slate
2. Click **Start Demo** — 2 calls appear, agents triage and route in the background
3. Click **Trigger Surge** — SURGE banner activates, 4 calls auto-triaged and routed
4. Watch the voice briefing fire (or read the text version if no ElevenLabs key)
5. A heavy asset call triggers **Protocol HOLD** — the modal blocks until the dispatcher confirms
6. Click **Override** — returns to Assisted Mode
7. Expand **Audit Trail** — full timestamped log of every agent decision

## Architecture

```
signal/
├── backend/              FastAPI + Python 3.11
│   ├── main.py           Entry point — lifespan, CORS, WebSocket, /audio static mount
│   ├── state.py          Single in-memory source of truth (resets on restart or /demo/reset)
│   ├── simulator.py      Poisson call generator (background task)
│   ├── agents/           MONITOR, TRIAGE, RESOURCE, RELAY
│   ├── routers/          REST endpoints — calls, state, override, hold, demo
│   ├── ws/hub.py         WebSocket broadcast hub
│   └── data/             park_fire.geojson, resources.json, vulnerability.json
└── frontend/             React 18 + Vite + Tailwind CSS
    └── src/
        ├── types.ts              Shared TypeScript types
        ├── store/reducer.ts      Pure reducer — all WebSocket message handling
        ├── hooks/useWebSocket.ts Auto-reconnecting WebSocket hook (3s retry)
        └── components/           Dashboard panels
```

### Agent pipeline (per call)

```
POST /call
  → TRIAGE  (Claude Haiku) → severity + incident_type + vulnerable flag
  → RESOURCE               → nearest available unit
      heavy asset?  → HOLD_REQUIRED  (dispatcher must confirm within 60s)
      standard?     → UNIT_DISPATCHED immediately
  → RELAY   (Claude Haiku) → briefing text → ElevenLabs TTS (optional)
  → BRIEFING_READY + INCIDENT_REPORT broadcast
```

## Smoke Test

Requires the backend to be running and `pip install websockets`:

```bash
bash scripts/smoke_test.sh
```

The script verifies: backend health, state reset, call injection, WebSocket `BRIEFING_READY` delivery, all three `/demo/*` endpoints, and call queue population.
