from fastapi import APIRouter, Query
from logger import get_log_entries

router = APIRouter()


@router.get("/logs")
async def get_logs(
    level: str | None = Query(default=None, description="Filter by level: DEBUG, INFO, WARNING, ERROR"),
    limit: int = Query(default=200, ge=1, le=500, description="Max entries to return"),
):
    return {"entries": get_log_entries(level=level, limit=limit)}
