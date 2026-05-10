from fastapi import APIRouter

import state

router = APIRouter()


@router.get("/state")
async def get_state():
    return {
        "mode": state.system_state["mode"],
        "surge_threshold": state.system_state["surge_threshold"],
        "call_queue": state.call_queue,
        "incident_log": state.incident_log,
        "resources": state.resources,
        "hold_queue": state.hold_queue,
        "fire_perimeter": state.fire_perimeter,
    }
