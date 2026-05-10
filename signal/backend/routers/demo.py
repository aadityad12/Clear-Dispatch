import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter

import state
from ws.hub import manager

_log = logging.getLogger("clear_dispatch.demo")

router = APIRouter(prefix="/demo")


@router.post("/reset")
async def demo_reset():
    state.system_state.update({
        "mode": "ASSISTED",
        "surge_started_at": None,
        "call_timestamps": [],
        "paused": False,
    })
    state.call_queue.clear()
    state.incident_log.clear()
    state.hold_queue.clear()
    state.live_transcripts.clear()
    state.live_extractions.clear()
    state.simulator_lambda["value"] = 0.1

    for r in state.resources:
        r["available"] = True

    now = datetime.now(timezone.utc).isoformat()
    await manager.broadcast("DEMO_RESET", {"timestamp": now})
    await manager.broadcast("MODE_CHANGE", {"mode": "ASSISTED", "timestamp": now})
    for agent in ("MONITOR", "TRIAGE", "RESOURCE", "RELAY"):
        await manager.broadcast("AGENT_STATUS", {"agent": agent, "status": "IDLE", "last_action": "System reset"})

    _log.info("Demo reset — all state cleared")
    return {"ok": True, "message": "State reset to clean"}


@router.post("/start")
async def demo_start():
    from routers.calls import process_call

    calls = [
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

    for call_data in calls:
        await process_call(call_data)
        await asyncio.sleep(2)

    _log.info("Demo started — 2 normal calls injected")
    return {"ok": True, "message": "Demo started — 2 calls injected in Assisted Mode"}


@router.post("/trigger-surge")
async def demo_trigger_surge():
    from routers.calls import process_call

    now = datetime.now(timezone.utc).isoformat()
    state.system_state["mode"] = "SURGE"
    state.system_state["surge_started_at"] = now
    state.system_state["paused"] = False
    state.simulator_lambda["value"] = 15.0

    await manager.broadcast("MODE_CHANGE", {"mode": "SURGE", "timestamp": now})
    await manager.broadcast("AGENT_STATUS", {
        "agent": "MONITOR",
        "status": "COMPLETE",
        "last_action": "Surge threshold crossed — 15 calls/min detected",
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
            "caller_id": "SURGE-004",
            "lat": 38.6200,
            "lon": -121.6800,
            "zone": "YL-02",
            "reported_type": "fire",
            "description": "Large wildfire jump, aerial suppression needed urgently, spreading toward residential",
            "force_heavy_asset": True,
        },
    ]

    for call_data in surge_calls:
        await process_call(call_data)
        await asyncio.sleep(0.8)

    _log.warning("Demo surge triggered — 4 calls injected, heavy asset included")
    return {"ok": True, "message": "Surge triggered — 4 calls injected, heavy asset call included"}


@router.post("/pause")
async def demo_pause():
    state.system_state["paused"] = True
    state.simulator_lambda["value"] = 0.0
    now = datetime.now(timezone.utc).isoformat()
    await manager.broadcast("DEMO_PAUSED", {"timestamp": now})
    _log.warning("Demo paused — API calls and simulator suspended")
    return {"ok": True, "paused": True}


@router.post("/resume")
async def demo_resume():
    state.system_state["paused"] = False
    state.simulator_lambda["value"] = 2.0
    now = datetime.now(timezone.utc).isoformat()
    await manager.broadcast("DEMO_RESUMED", {"timestamp": now})
    _log.warning("Demo resumed — simulator restored to 2.0 calls/min")
    return {"ok": True, "paused": False}
