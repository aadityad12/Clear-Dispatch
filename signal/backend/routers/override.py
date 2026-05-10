from datetime import datetime, timezone

from fastapi import APIRouter

import state
from ws.hub import manager

router = APIRouter()


@router.post("/override")
async def override():
    now = datetime.now(timezone.utc).isoformat()
    state.system_state["mode"] = "ASSISTED"

    state.incident_log.append({
        "call_id": None,
        "timestamp": now,
        "event": "DISPATCHER_OVERRIDE",
        "dispatcher_override": True,
    })

    await manager.broadcast("MODE_CHANGE", {"mode": "ASSISTED", "timestamp": now})

    return {"ok": True}
