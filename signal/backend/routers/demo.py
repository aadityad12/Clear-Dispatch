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
