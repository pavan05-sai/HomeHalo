from fastapi import APIRouter, Query
from typing import Optional
from .. import services

router = APIRouter()


@router.get("/actions")
def get_actions():
    return services.get_actions()


@router.get("/summary")
def get_summary():
    return services.get_summary()


@router.get("/activity")
def get_activity(
    limit: int = Query(50, ge=1, le=200),
    kind: Optional[str] = None,
):
    return services.get_activity(limit=limit, kind=kind)
