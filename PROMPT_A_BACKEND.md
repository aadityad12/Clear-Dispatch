# SIGNAL — Backend Implementation Prompt (Person 1)

You are implementing the complete backend for **SIGNAL**, a human-in-the-loop emergency dispatch support system for wildfire surge events. This is for HackDavis 2026 — a 24-hour hackathon. Build a working MVP, not production-grade code.

**Your deliverable**: The complete `signal/backend/` directory. When done, `uvicorn main:app --reload --port 8000` must start without errors.

---

## Prerequisites

- Python 3.11+
- `uv` installed: `pip install uv`
- `.env` file with at minimum `ANTHROPIC_API_KEY=your_key`

## Run Command

```bash
cd signal/backend
uv sync
uvicorn main:app --reload --port 8000
```

---

## Directory Structure to Create

```
signal/backend/
├── pyproject.toml
├── .env.example
├── main.py
├── state.py
├── simulator.py
├── agents/
│   ├── __init__.py
│   ├── monitor.py
│   ├── triage.py
│   ├── resource.py
│   └── relay.py
├── routers/
│   ├── __init__.py
│   ├── calls.py
│   ├── state_router.py
│   ├── override.py
│   ├── hold.py
│   └── demo.py
├── ws/
│   ├── __init__.py
│   └── hub.py
└── data/
    ├── park_fire.geojson
    ├── resources.json
    └── vulnerability.json
```

---

## Shared Contract (must match frontend exactly — do not change these values)

```
Backend port:   8000
WebSocket path: /ws
Mode values:    ASSISTED | SURGE
Severity:       CRITICAL | URGENT | STANDARD
Agent names:    MONITOR | TRIAGE | RESOURCE | RELAY
Agent statuses: IDLE | RUNNING | COMPLETE | ERROR
Heavy assets:   air_tanker | heavy_rescue | hazmat
Surge env var:  SURGE_THRESHOLD (default: 10 calls/min)
```

WebSocket messages the backend must broadcast:
```json
{ "type": "MODE_CHANGE",     "payload": { "mode": "SURGE|ASSISTED", "timestamp": "ISO8601" } }
{ "type": "CALL_ADDED",      "payload": { "id": "str", "severity": "str", "zone": "str", "vulnerable": bool, "incident_type": "str" } }
{ "type": "AGENT_STATUS",    "payload": { "agent": "str", "status": "str", "last_action": "str" } }
{ "type": "UNIT_DISPATCHED", "payload": { "call_id": "str", "unit_id": "str", "eta_minutes": int } }
{ "type": "HOLD_REQUIRED",   "payload": { "call_id": "str", "unit_id": "str", "asset_type": "str", "hold_id": "str" } }
{ "type": "HOLD_RESOLVED",   "payload": { "hold_id": "str", "action": "CONFIRMED|CANCELLED" } }
{ "type": "BRIEFING_READY",  "payload": { "call_id": "str", "text": "str", "audio_url": "str|null" } }
{ "type": "INCIDENT_REPORT", "payload": { "call_id": "str", "report": {} } }
```

---

## File Specifications

### `pyproject.toml`

```toml
[project]
name = "signal-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "anthropic>=0.25.0",
    "httpx>=0.27.0",
    "python-dotenv>=1.0.0",
    "websockets>=12.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### `.env.example`

```
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
SURGE_THRESHOLD=10
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### `state.py`

Holds all in-memory application state. Import this everywhere — never define state in other modules.

```python
import asyncio
from datetime import datetime
from typing import Any

system_state: dict[str, Any] = {
    "mode": "ASSISTED",
    "surge_threshold": 10,
    "surge_started_at": None,
    "call_timestamps": [],   # list of ISO timestamps for sliding window
}

call_queue: list[dict] = []       # active/pending calls
incident_log: list[dict] = []     # completed incidents with audit trail
hold_queue: dict[str, dict] = {}  # hold_id -> hold record
simulator_lambda: dict = {"value": 2.0}  # calls/min, mutable for surge

# Loaded from data/ on startup
resources: list[dict] = []
vulnerability_data: dict[str, float] = {}
fire_perimeter: dict = {}
```

### `ws/hub.py`

WebSocket connection manager. All broadcasts go through this.

```python
import asyncio
import json
from datetime import datetime, timezone
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, event_type: str, payload: dict):
        msg = json.dumps({"type": event_type, "payload": payload})
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

manager = ConnectionManager()
```

### `main.py`

FastAPI application entry point.

- Use `@asynccontextmanager` lifespan to:
  1. Load `data/resources.json` into `state.resources`
  2. Load `data/vulnerability.json` into `state.vulnerability_data`
  3. Load `data/park_fire.geojson` into `state.fire_perimeter`
  4. Load `SURGE_THRESHOLD` from env into `state.system_state["surge_threshold"]`
  5. Start `monitor_loop()` as background asyncio task
  6. Start `simulator_loop()` as background asyncio task
- Mount routers: `/call` and `/calls` from `routers/calls`, `/state` from `routers/state_router`, `/override` from `routers/override`, `/confirm-hold` and `/cancel-hold` from `routers/hold`, `/demo/*` from `routers/demo`
- Add CORS middleware — allow origins `["http://localhost:5173"]`, all methods, all headers (Person 3 will update this but add the placeholder now)
- Add WebSocket endpoint at `/ws` that calls `manager.connect()`, then loops reading messages (ignore them), handles disconnect on exception
- Add `GET /health` → `{"status": "ok", "mode": state.system_state["mode"]}`

### `agents/monitor.py`

The MONITOR agent. Runs continuously as a background asyncio task.

Responsibilities:
1. Maintain a sliding 60-second window of call timestamps from `state.system_state["call_timestamps"]`
2. Every 5 seconds: prune timestamps older than 60s, compute calls-per-minute rate
3. If rate > `surge_threshold` AND current mode is `ASSISTED`:
   - Set `system_state["mode"] = "SURGE"`
   - Set `system_state["surge_started_at"]` to now
   - Broadcast `MODE_CHANGE` with `{"mode": "SURGE", "timestamp": now}`
   - Broadcast `AGENT_STATUS` for MONITOR: `{"agent": "MONITOR", "status": "COMPLETE", "last_action": f"Surge detected: {rate:.1f} calls/min"}`
4. If rate <= `surge_threshold` AND current mode is `SURGE` AND surge has been active > 120 seconds:
   - Set `system_state["mode"] = "ASSISTED"`
   - Broadcast `MODE_CHANGE` with `{"mode": "ASSISTED", ...}`
5. Always broadcast `AGENT_STATUS` MONITOR with current status on each poll

```python
async def monitor_loop():
    while True:
        await asyncio.sleep(5)
        # ... sliding window logic above
```

### `agents/triage.py`

The TRIAGE agent. Called once per incoming call.

```python
from dataclasses import dataclass

@dataclass
class TriageResult:
    severity: str        # CRITICAL | URGENT | STANDARD
    incident_type: str   # fire | evacuation | medical | structure | other
    zone: str
    vulnerable: bool
    reasoning: str
```

Implementation:
1. Broadcast `AGENT_STATUS` TRIAGE `RUNNING` before Claude call
2. Build a Claude prompt with:
   - Caller's reported incident type, location description, zone ID
   - Vulnerability score for the zone (from `state.vulnerability_data`)
   - Current system mode
   - Instruction: classify severity as CRITICAL/URGENT/STANDARD, identify incident type, flag if vulnerable population likely affected
   - Ask for JSON output: `{"severity": "...", "incident_type": "...", "vulnerable": bool, "reasoning": "..."}`
3. Call `anthropic.messages.create` with `model="claude-haiku-4-5-20251001"` (fast, cheap for triage)
4. Parse JSON from response. If parsing fails, default to `URGENT`
5. Broadcast `AGENT_STATUS` TRIAGE `COMPLETE` with `last_action` summarizing the result
6. Return `TriageResult`

Use `model="claude-haiku-4-5-20251001"` for speed. Never use a model larger than needed.

### `agents/resource.py`

The RESOURCE agent. Called after TRIAGE.

Responsibilities:
1. Broadcast `AGENT_STATUS` RESOURCE `RUNNING`
2. Find the nearest **available** unit to the incident coordinates using haversine distance
3. Calculate ETA: `distance_km / 80 * 60` minutes (80 km/h average)
4. Mark the unit as unavailable in `state.resources`
5. If `unit["type"]` is in `["air_tanker", "heavy_rescue", "hazmat"]`:
   - Generate a `hold_id` (uuid4)
   - Add to `state.hold_queue`
   - Broadcast `HOLD_REQUIRED` — do NOT dispatch yet
   - Wait up to 60 seconds for confirmation (poll `hold_queue[hold_id]["resolved"]` every 2s)
   - If confirmed: dispatch (broadcast `UNIT_DISPATCHED`)
   - If cancelled or timed out: restore unit availability, log cancellation
6. For standard assets: broadcast `UNIT_DISPATCHED` immediately
7. Broadcast `AGENT_STATUS` RESOURCE `COMPLETE`

Haversine formula (implement in Python, don't import external library):
```python
import math
def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))
```

### `agents/relay.py`

The RELAY agent. Called after RESOURCE to generate dispatcher briefings.

Responsibilities:
1. Broadcast `AGENT_STATUS` RELAY `RUNNING`
2. Call Claude (`claude-haiku-4-5-20251001`) to generate a concise dispatcher briefing:
   - Prompt: given call details, triage result, resource assignment — generate a spoken briefing in this format:
     `"Incident [ID]. [Severity]. [Zone]. [Incident type]. Unit [unit_id] dispatched. ETA [N] minutes."`
   - Keep it under 25 words. No filler. Clipped and direct.
3. If `ELEVENLABS_API_KEY` is set:
   - `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with the briefing text
   - Save audio bytes to `signal/backend/audio/{call_id}.mp3`
   - Set `audio_url = f"/audio/{call_id}.mp3"`
   - Mount `/audio` as a static directory in `main.py`
   - If ElevenLabs call fails for any reason: log the error, set `audio_url = None`, continue
4. If no `ELEVENLABS_API_KEY`: set `audio_url = None`
5. Append full audit record to `state.incident_log`
6. Broadcast `BRIEFING_READY` with text and audio_url
7. Broadcast `INCIDENT_REPORT` with the full audit record
8. Broadcast `AGENT_STATUS` RELAY `COMPLETE`

Audit record structure:
```python
{
    "call_id": str,
    "timestamp": ISO8601,
    "triage": TriageResult.__dict__,
    "resource": {"unit_id": str, "eta_minutes": int, "requires_hold": bool},
    "briefing_text": str,
    "audio_url": str | None,
    "dispatcher_override": False,
    "hold_confirmed": bool | None,
}
```

### `routers/calls.py`

```
POST /call
Body: {
    "caller_id": str,
    "lat": float,
    "lon": float,
    "zone": str,
    "reported_type": str,   # fire | evacuation | medical | structure
    "description": str
}
```

Handler:
1. Generate `call_id` (uuid4 short: first 8 chars)
2. Append ISO timestamp to `state.system_state["call_timestamps"]`
3. Create call record and append to `state.call_queue`
4. Broadcast `CALL_ADDED` with `{id, severity: "PENDING", zone, vulnerable: false, incident_type: reported_type}`
5. Launch background task: run TRIAGE → RESOURCE → RELAY pipeline
6. In the background pipeline:
   - Run `triage_agent(call)`
   - Update call in queue with triage result; re-broadcast `CALL_ADDED` with real severity
   - In SURGE mode: run `resource_agent(call, triage_result)` automatically
   - In ASSISTED mode: only run resource if dispatcher explicitly requests (for MVP, run it automatically too)
   - Run `relay_agent(call, triage_result, resource_result)`
7. Return `{"call_id": call_id}`

```
GET /calls
```
Returns `state.call_queue`.

### `routers/state_router.py`

```
GET /state
```
Returns:
```json
{
    "mode": "ASSISTED|SURGE",
    "surge_threshold": 10,
    "call_queue": [...],
    "incident_log": [...],
    "resources": [...],
    "hold_queue": {...}
}
```

### `routers/override.py`

```
POST /override
```
Sets `system_state["mode"] = "ASSISTED"`. Appends override event to `incident_log`. Broadcasts `MODE_CHANGE` with `{"mode": "ASSISTED"}`. Returns `{"ok": true}`.

### `routers/hold.py`

```
POST /confirm-hold
Body: { "hold_id": str }
```
Sets `hold_queue[hold_id]["resolved"] = "CONFIRMED"`. Broadcasts `HOLD_RESOLVED`.

```
POST /cancel-hold
Body: { "hold_id": str }
```
Sets `hold_queue[hold_id]["resolved"] = "CANCELLED"`. Broadcasts `HOLD_RESOLVED`.

### `routers/demo.py`

Leave this as stubs — Person 3 fills in the logic:

```python
from fastapi import APIRouter
router = APIRouter(prefix="/demo")

@router.post("/start")
async def demo_start():
    # Person 3 implements
    return {"ok": True, "message": "Demo start stub"}

@router.post("/trigger-surge")
async def demo_trigger_surge():
    # Person 3 implements
    return {"ok": True, "message": "Trigger surge stub"}

@router.post("/reset")
async def demo_reset():
    # Person 3 implements
    return {"ok": True, "message": "Reset stub"}
```

### `simulator.py`

Poisson call generator. Runs as a background asyncio task.

```python
import asyncio
import random
import uuid
from datetime import datetime

# Davis/Yolo County bounding box
LAT_MIN, LAT_MAX = 38.30, 38.90
LON_MIN, LON_MAX = -122.30, -121.50

ZONES = ["YL-01", "YL-02", "YL-03", "YL-04", "YL-05", "YL-06", "YL-07", "YL-08"]
INCIDENT_TYPES = ["fire", "evacuation", "medical", "structure"]
DESCRIPTIONS = [
    "Smoke visible from Highway 113",
    "Residents unable to evacuate due to road closure",
    "Elderly resident trapped, mobility impaired",
    "Structure fire spreading to adjacent units",
    "Caller reports fire approaching from hillside",
    "Multiple callers reporting same fire near Cache Creek",
]

async def simulator_loop():
    """Generate calls using Poisson process. Rate controlled by state.simulator_lambda."""
    from state import call_queue, system_state, simulator_lambda
    import httpx

    while True:
        lam = simulator_lambda["value"]
        # Inter-arrival time for Poisson process: exponential with mean 1/lambda (in minutes)
        interval_seconds = random.expovariate(lam / 60)
        await asyncio.sleep(interval_seconds)

        call_data = {
            "caller_id": f"CALLER-{uuid.uuid4().hex[:6].upper()}",
            "lat": round(random.uniform(LAT_MIN, LAT_MAX), 6),
            "lon": round(random.uniform(LON_MIN, LON_MAX), 6),
            "zone": random.choice(ZONES),
            "reported_type": random.choice(INCIDENT_TYPES),
            "description": random.choice(DESCRIPTIONS),
        }

        async with httpx.AsyncClient() as client:
            try:
                await client.post("http://localhost:8000/call", json=call_data, timeout=5)
            except Exception:
                pass  # Don't crash simulator on transient errors
```

---

## Data Files

### `data/resources.json`

Create a JSON array of 20 response units. Use this structure for each unit:

```json
{
    "id": "UNIT-001",
    "type": "engine",
    "name": "Engine 34",
    "lat": 38.5449,
    "lon": -121.7405,
    "available": true,
    "station": "Davis Fire Station 34"
}
```

Unit types and counts:
- 12 × `engine` — spread across Davis (38.54, -121.74), Woodland (38.68, -121.77), West Sacramento (38.58, -121.53), Winters (38.52, -121.97)
- 4 × `personnel` — medical/rescue teams, same locations
- 2 × `air_tanker` — positioned at McClellan Airport (38.67, -121.40) and Mather Airport (38.56, -121.30)
- 1 × `heavy_rescue` — Davis station
- 1 × `hazmat` — West Sacramento

Air tankers and heavy rescue have `"type": "air_tanker"`, `"type": "heavy_rescue"`, `"type": "hazmat"` respectively — these trigger Protocol HOLD.

### `data/vulnerability.json`

Zone ID → vulnerability score (0.0 = lowest, 1.0 = highest). Higher = more elderly/mobility-impaired/non-English population.

```json
{
    "YL-01": 0.72,
    "YL-02": 0.45,
    "YL-03": 0.88,
    "YL-04": 0.31,
    "YL-05": 0.63,
    "YL-06": 0.19,
    "YL-07": 0.55,
    "YL-08": 0.77
}
```

A zone is flagged as `vulnerable: true` in triage if score > 0.6.

### `data/park_fire.geojson`

The 2024 Park Fire burned ~429,000 acres in Northern California (Tehama/Butte/Plumas counties), roughly 100 miles north of Davis. For the demo, create a realistic GeoJSON FeatureCollection with one polygon approximating the fire perimeter. Use these approximate coordinates (simplified outline):

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Park Fire 2024",
        "acres": 429083,
        "containment": 100,
        "updated": "2024-09-01"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-121.90, 39.75],
          [-121.60, 39.70],
          [-121.40, 39.80],
          [-121.30, 40.00],
          [-121.35, 40.25],
          [-121.50, 40.45],
          [-121.70, 40.55],
          [-121.95, 40.50],
          [-122.10, 40.35],
          [-122.05, 40.10],
          [-122.00, 39.90],
          [-121.90, 39.75]
        ]]
      }
    }
  ]
}
```

---

## Agent Pipeline Flow

```
Incoming call (POST /call)
    │
    ▼
CALL_ADDED broadcast (severity: PENDING)
    │
    ▼
TRIAGE agent
  → Claude Haiku: classify severity + incident type
  → Check vulnerability score for zone
  → Returns TriageResult
  → Broadcast CALL_ADDED again (now with real severity)
  → Broadcast AGENT_STATUS TRIAGE COMPLETE
    │
    ▼
RESOURCE agent
  → Find nearest available unit
  → Calculate ETA
  → If heavy asset: HOLD_REQUIRED → wait for confirmation
  → Otherwise: UNIT_DISPATCHED immediately
  → Broadcast AGENT_STATUS RESOURCE COMPLETE
    │
    ▼
RELAY agent
  → Claude Haiku: generate dispatcher briefing text
  → ElevenLabs TTS (if key present), fallback to text-only
  → Write audit record to incident_log
  → Broadcast BRIEFING_READY
  → Broadcast INCIDENT_REPORT
  → Broadcast AGENT_STATUS RELAY COMPLETE
```

---

## Important Notes

1. **Never make Claude agents block the event loop** — always use `await asyncio.to_thread()` for the Anthropic client if it's synchronous, or use the async client.
2. **ElevenLabs must never crash the pipeline** — wrap all TTS calls in try/except; log the error and continue with `audio_url = None`.
3. **Resource agent must never invent units** — it can ONLY select from `state.resources`. It cannot create new resources.
4. **Protocol HOLD is real** — when a heavy asset is needed, the dispatch MUST pause and wait for human confirmation. Do not dispatch automatically.
5. **All state is in-memory** — no SQLite, no Redis, no files (except audio output). State resets on server restart and on `POST /demo/reset`.
6. Use `claude-haiku-4-5-20251001` for all Claude calls — it's fast enough for real-time triage and cheap enough for hackathon usage.
