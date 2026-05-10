from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import state
from ws.hub import manager

router = APIRouter()


class HoldRequest(BaseModel):
    hold_id: str


@router.post("/confirm-hold")
async def confirm_hold(body: HoldRequest):
    hold = state.hold_queue.get(body.hold_id)
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    hold["resolved"] = "CONFIRMED"
    await manager.broadcast("HOLD_RESOLVED", {"hold_id": body.hold_id, "action": "CONFIRMED"})
    return {"ok": True}


@router.post("/cancel-hold")
async def cancel_hold(body: HoldRequest):
    hold = state.hold_queue.get(body.hold_id)
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    hold["resolved"] = "CANCELLED"
    await manager.broadcast("HOLD_RESOLVED", {"hold_id": body.hold_id, "action": "CANCELLED"})
    return {"ok": True}
