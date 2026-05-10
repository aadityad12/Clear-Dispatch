# SIGNAL — Integration & Demo Prompt (Person 3)

You are the integration engineer for **SIGNAL**, a human-in-the-loop emergency dispatch support system built for HackDavis 2026. Person 1 built the backend. Person 2 built the frontend. Your job is to wire them together, implement the scripted demo flow, and ensure the system works end-to-end.

**Start this prompt after Person 1's backend is running** (`GET http://localhost:8000/health` returns 200).

---

## Your Deliverables

1. **`signal/backend/routers/demo.py`** — complete scripted demo flow (replaces the stub Person 1 left)
2. **CORS in `signal/backend/main.py`** — ensure frontend can reach the backend
3. **Root `README.md`** — full setup guide for the whole project
4. **`scripts/smoke_test.sh`** — automated end-to-end smoke test
5. **`signal/frontend/.env`** — frontend environment variables (may already exist from Person 2)

---

## Shared Contract (for reference)

```
Backend port:  8000
Frontend port: 5173
WebSocket:     ws://localhost:8000/ws
```

---

## 1. Complete `signal/backend/routers/demo.py`

Replace the stub file. Implement the three endpoints with full logic.

### `POST /demo/reset`

Reset all in-memory state to clean values:

```python
from fastapi import APIRouter
from datetime import datetime
import asyncio
from state import system_state, call_queue, incident_log, hold_queue, simulator_lambda, resources
from ws.hub import manager
import json

router = APIRouter(prefix="/demo")

@router.post("/reset")
async def demo_reset():
    system_state.update({
        "mode": "ASSISTED",
        "surge_started_at": None,
        "call_timestamps": [],
    })
    call_queue.clear()
    incident_log.clear()
    hold_queue.clear()
    simulator_lambda["value"] = 2.0

    # Re-mark all resources as available
    for r in resources:
        r["available"] = True

    await manager.broadcast("MODE_CHANGE", {"mode": "ASSISTED", "timestamp": datetime.utcnow().isoformat()})
    await manager.broadcast("AGENT_STATUS", {"agent": "MONITOR", "status": "IDLE", "last_action": "System reset"})
    await manager.broadcast("AGENT_STATUS", {"agent": "TRIAGE", "status": "IDLE", "last_action": "Ready"})
    await manager.broadcast("AGENT_STATUS", {"agent": "RESOURCE", "status": "IDLE", "last_action": "Ready"})
    await manager.broadcast("AGENT_STATUS", {"agent": "RELAY", "status": "IDLE", "last_action": "Ready"})

    return {"ok": True, "message": "State reset to clean"}
```

### `POST /demo/start`

Inject 2 normal calls to demonstrate Assisted Mode. Use the internal call handler directly (don't make HTTP requests to self):

```python
@router.post("/start")
async def demo_start():
    from routers.calls import process_call  # import the internal handler

    normal_calls = [
        {
            "caller_id": "DEMO-001",
            "lat": 38.5449,
            "lon": -121.7405,
            "zone": "YL-03",
            "reported_type": "fire",
            "description": "Smoke visible from Russell Boulevard, wind picking up",
        },
        {
            "caller_id": "DEMO-002",
            "lat": 38.6812,
            "lon": -121.7731,
            "zone": "YL-01",
            "reported_type": "evacuation",
            "description": "Elderly resident at 412 Gibson Road cannot self-evacuate",
        },
    ]

    for call_data in normal_calls:
        await process_call(call_data)
        await asyncio.sleep(2)

    return {"ok": True, "message": "Demo started — 2 calls injected in Assisted Mode"}
```

### `POST /demo/trigger-surge`

Force SURGE mode and inject 4 rapid calls, including one that requires a heavy asset:

```python
@router.post("/trigger-surge")
async def demo_trigger_surge():
    from routers.calls import process_call
    from datetime import datetime, timezone

    # Force surge mode
    now = datetime.now(timezone.utc).isoformat()
    system_state["mode"] = "SURGE"
    system_state["surge_started_at"] = now
    simulator_lambda["value"] = 15.0

    await manager.broadcast("MODE_CHANGE", {"mode": "SURGE", "timestamp": now})
    await manager.broadcast("AGENT_STATUS", {
        "agent": "MONITOR",
        "status": "COMPLETE",
        "last_action": "Surge threshold crossed — 15 calls/min detected"
    })

    await asyncio.sleep(0.5)

    surge_calls = [
        {
            "caller_id": "SURGE-001",
            "lat": 38.5200,
            "lon": -121.8100,
            "zone": "YL-05",
            "reported_type": "fire",
            "description": "Structure fire, multiple units, flames visible from freeway",
        },
        {
            "caller_id": "SURGE-002",
            "lat": 38.4800,
            "lon": -121.7600,
            "zone": "YL-03",
            "reported_type": "evacuation",
            "description": "Assisted living facility needs immediate evacuation, 40 residents",
        },
        {
            "caller_id": "SURGE-003",
            "lat": 38.5600,
            "lon": -121.9200,
            "zone": "YL-07",
            "reported_type": "medical",
            "description": "Wildfire smoke inhalation, patient unresponsive",
        },
        {
            # This call should trigger Protocol HOLD via air tanker request
            "caller_id": "SURGE-004",
            "lat": 38.6200,
            "lon": -121.6800,
            "zone": "YL-02",
            "reported_type": "fire",
            "description": "Large wildfire jump, aerial suppression needed urgently, spreading toward residential",
            "force_heavy_asset": True,  # hint to resource agent if supported, otherwise it may select naturally
        },
    ]

    for call_data in surge_calls:
        await process_call(call_data)
        await asyncio.sleep(0.8)

    return {"ok": True, "message": "Surge triggered — 4 calls injected, heavy asset call included"}
```

**Note**: If `process_call` doesn't accept `force_heavy_asset`, remove that key before passing. The 4th call's description should naturally cause TRIAGE to rate it CRITICAL, which increases the chance RESOURCE selects an air tanker. If the resource agent doesn't reliably pick heavy assets, add a parameter to the call payload that RESOURCE checks.

---

## 2. Add CORS to `signal/backend/main.py`

Find the `app = FastAPI(...)` line in `main.py`. Add the CORS middleware immediately after it:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Also add a static files mount for audio (if RELAY generates audio files):

```python
import os
from fastapi.staticfiles import StaticFiles

audio_dir = "audio"
os.makedirs(audio_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")
```

---

## 3. Write Root `README.md`

Create a comprehensive README at the repo root:

```markdown
# SIGNAL — Surge-Intelligent Guard Network for Alert & Logistics

Human-in-the-loop emergency dispatch support for wildfire surge events. Built at HackDavis 2026.

## What It Does

SIGNAL assists 911 dispatchers during wildfire emergencies. Four AI agents (MONITOR, TRIAGE, RESOURCE, RELAY) run in the background. During normal operations, they assist silently. When call volume crosses a threshold, the system enters Surge Mode and agents begin triaging and routing automatically — but the dispatcher can override any action at any time.

**The AI never speaks to callers. The dispatcher is always the human interface.**

## Quick Start

### Requirements

- Python 3.11+ and `uv` (`pip install uv`)
- Node.js 18+
- An Anthropic API key

### 1. Backend

```bash
cd signal/backend
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=your_key
uv sync
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Health check: `GET /health`.

### 2. Frontend

```bash
cd signal/frontend
npm install
npm run dev
```

Dashboard at `http://localhost:5173`.

## Environment Variables

### `signal/backend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key for TRIAGE + RELAY agents |
| `ELEVENLABS_API_KEY` | No | — | Voice briefings. Text-only mode if absent |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | ElevenLabs voice ID |
| `SURGE_THRESHOLD` | No | `10` | Calls/min to trigger Surge Mode |

### `signal/frontend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_WS_URL` | No | `ws://localhost:8000/ws` | WebSocket backend URL |

## Demo (for judges)

1. Open `http://localhost:5173`
2. Click **Reset** (bottom bar) → clears all state
3. Click **Start Demo** → 2 calls appear, agents assist in background
4. Click **Trigger Surge** → SURGE banner activates, 4 calls auto-triaged and routed
5. Watch ElevenLabs voice briefing fire (or text if no key)
6. Heavy asset call triggers **Protocol HOLD** modal — dispatcher must confirm
7. Click **Override** → returns to Assisted Mode
8. Expand **Audit Trail** → full timestamped log of all agent decisions

## Architecture

```
signal/
├── backend/              FastAPI + Python 3.11
│   ├── agents/           MONITOR, TRIAGE, RESOURCE, RELAY
│   ├── routers/          REST API endpoints
│   ├── ws/               WebSocket hub
│   ├── data/             Park Fire GeoJSON, mock resources, vulnerability data
│   └── simulator.py      Poisson call generator
└── frontend/             React 18 + Vite + Tailwind CSS
    └── src/
        ├── components/   Dashboard panels
        ├── hooks/        WebSocket connection
        └── store/        State reducer
```

## The Four Agents

| Agent | Role | When it runs |
|---|---|---|
| MONITOR | Watches call volume, controls mode | Always (background loop) |
| TRIAGE | Classifies severity and incident type | Per incoming call |
| RESOURCE | Selects and dispatches response units | After TRIAGE |
| RELAY | Generates dispatcher briefings + voice | After RESOURCE |

## PRD

Full product requirements: [GitHub Issue #1](https://github.com/aadityad12/HackDavis26/issues/1)
```

---

## 4. Write `scripts/smoke_test.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="http://localhost:8000"
WS_URL="ws://localhost:8000/ws"
TIMEOUT=30

echo "=== SIGNAL Smoke Test ==="

# 1. Wait for backend health
echo "[1/4] Waiting for backend..."
for i in $(seq 1 20); do
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo "    Backend ready."
        break
    fi
    if [ $i -eq 20 ]; then
        echo "    ERROR: Backend not responding after 20 attempts."
        exit 1
    fi
    sleep 1
done

# 2. Reset state
echo "[2/4] Resetting state..."
curl -sf -X POST "$BACKEND_URL/demo/reset" > /dev/null
echo "    Reset OK."

# 3. Post a test call
echo "[3/4] Posting test call..."
RESPONSE=$(curl -sf -X POST "$BACKEND_URL/call" \
    -H "Content-Type: application/json" \
    -d '{
        "caller_id": "SMOKE-001",
        "lat": 38.5449,
        "lon": -121.7405,
        "zone": "YL-03",
        "reported_type": "fire",
        "description": "Smoke test call — automated"
    }')
CALL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['call_id'])")
echo "    Call ID: $CALL_ID"

# 4. Wait for BRIEFING_READY on WebSocket
echo "[4/4] Waiting for BRIEFING_READY on WebSocket (timeout: ${TIMEOUT}s)..."
RESULT=$(python3 - <<PYEOF
import asyncio, json, sys

async def wait_for_briefing():
    import websockets
    try:
        async with websockets.connect("$WS_URL") as ws:
            async with asyncio.timeout($TIMEOUT):
                saw_call_added = False
                saw_briefing = False
                async for raw in ws:
                    msg = json.loads(raw)
                    if msg["type"] == "CALL_ADDED" and msg["payload"]["id"] == "$CALL_ID":
                        saw_call_added = True
                        print("    CALL_ADDED received.", flush=True)
                    if msg["type"] == "BRIEFING_READY" and msg["payload"]["call_id"] == "$CALL_ID":
                        saw_briefing = True
                        print(f"    BRIEFING_READY received: {msg['payload']['text'][:60]}...", flush=True)
                    if saw_call_added and saw_briefing:
                        return 0
    except asyncio.TimeoutError:
        print("    TIMEOUT: Did not receive expected messages.", flush=True)
        return 1

sys.exit(asyncio.run(wait_for_briefing()))
PYEOF
)
echo "$RESULT"

echo ""
echo "=== Smoke test PASSED ==="
exit 0
```

Make it executable: `chmod +x scripts/smoke_test.sh`

The script requires `websockets` Python package: `pip install websockets` or ensure it's in the backend venv.

---

## 5. Verify `signal/frontend/.env`

Check if this file exists. If not, create it:

```
VITE_WS_URL=ws://localhost:8000/ws
```

---

## End-to-End Verification Checklist

Run through this before the demo:

```
[ ] cd signal/backend && uv sync && uvicorn main:app --reload
[ ] GET http://localhost:8000/health → {"status": "ok", "mode": "ASSISTED"}
[ ] cd signal/frontend && npm install && npm run dev
[ ] http://localhost:5173 loads dashboard in ASSISTED mode
[ ] WebSocket connection indicator is green
[ ] Click "Reset" → state clears
[ ] Click "Start Demo" → 2 calls appear in queue with triage badges
[ ] Click "Trigger Surge" → red SURGE banner fires, 4 agent cards update
[ ] HOLD modal appears for the heavy asset call
[ ] Confirm HOLD → unit dispatched, modal closes
[ ] Click "Override" → returns to ASSISTED mode, blue banner
[ ] Expand Audit Trail → all actions timestamped
[ ] bash scripts/smoke_test.sh → exits 0
```

---

## Common Issues

**CORS error in browser console**
→ Make sure CORS middleware is in `main.py` and backend has restarted.

**WebSocket keeps reconnecting**
→ Check backend is running on port 8000. Check `VITE_WS_URL` in `signal/frontend/.env`.

**Agents run but no briefing text**
→ Check `ANTHROPIC_API_KEY` is set in `signal/backend/.env` and is valid.

**Map doesn't load**
→ Leaflet CSS must be imported in `index.css`, not in the component. Container div needs fixed height.

**Audio not playing**
→ Browser blocks autoplay. Show a "Click to play" button as fallback. Or just demo without audio and show the text briefing.

**Protocol HOLD never triggers**
→ The 4th surge call (SURGE-004) needs to route to an air tanker or heavy asset. If RESOURCE is selecting engines instead, temporarily mark all engines as unavailable in `resources.json` before the demo, or modify the demo call to pass a flag that forces heavy asset selection.
