import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

import state
from ws.hub import manager

router = APIRouter()


class CallRequest(BaseModel):
    caller_id: str
    lat: float
    lon: float
    zone: str
    reported_type: str
    description: str


async def process_call(call_data: dict) -> dict:
    call_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    # Pop demo-only flag before storing call record
    force_heavy = call_data.pop("force_heavy_asset", False)

    state.system_state["call_timestamps"].append(now)

    call = {
        "id": call_id,
        "caller_id": call_data.get("caller_id", "UNKNOWN"),
        "lat": call_data.get("lat", 38.5449),
        "lon": call_data.get("lon", -121.7405),
        "zone": call_data.get("zone", "YL-01"),
        "reported_type": call_data.get("reported_type", "fire"),
        "description": call_data.get("description", ""),
        "severity": "PENDING",
        "incident_type": call_data.get("reported_type", "fire"),
        "vulnerable": False,
        "timestamp": now,
        "unit_id": None,
        "eta_minutes": None,
        "briefing_text": None,
        "force_heavy_asset": force_heavy,
    }
    state.call_queue.append(call)

    await manager.broadcast("CALL_ADDED", {
        "id": call_id,
        "severity": "PENDING",
        "zone": call["zone"],
        "vulnerable": False,
        "incident_type": call["reported_type"],
    })

    asyncio.create_task(_run_pipeline(call))

    return {"call_id": call_id}


async def _run_pipeline(call: dict) -> None:
    from agents.triage import triage_agent
    from agents.resource import resource_agent
    from agents.relay import relay_agent

    triage = await triage_agent(call)

    # Update call in queue with real triage data
    for c in state.call_queue:
        if c["id"] == call["id"]:
            c["severity"] = triage.severity
            c["incident_type"] = triage.incident_type
            c["vulnerable"] = triage.vulnerable
            break

    await manager.broadcast("CALL_ADDED", {
        "id": call["id"],
        "severity": triage.severity,
        "zone": triage.zone,
        "vulnerable": triage.vulnerable,
        "incident_type": triage.incident_type,
    })

    resource_result = await resource_agent(call, triage)

    # Update call with dispatch info
    for c in state.call_queue:
        if c["id"] == call["id"]:
            c["unit_id"] = resource_result.get("unit_id")
            c["eta_minutes"] = resource_result.get("eta_minutes")
            break

    await relay_agent(call, triage, resource_result)


@router.post("/call")
async def create_call(body: CallRequest):
    return await process_call(body.model_dump())


@router.get("/calls")
async def get_calls():
    return state.call_queue
