from fastapi import APIRouter, Query
from typing import Optional
from ..models import RecordEventRequest
from .. import services

router = APIRouter()


@router.post("/events", status_code=201)
def record_event(body: RecordEventRequest):
    return services.record_event(
        event_type=body.event_type.value,
        payload=body.payload,
        occurred_at=body.occurred_at,
        client_request_id=body.client_request_id,
    )


@router.get("/events")
def list_events(
    limit: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = None,
    level: Optional[str] = None,
):
    return services.get_events(limit=limit, event_type=event_type, level=level)


@router.get("/events/{event_id}")
def get_event(event_id: str):
    return services.get_event(event_id)


@router.post("/events/{event_id}/assess")
def assess_event(event_id: str):
    return services.assess_event(event_id)


@router.post("/events/{event_id}/plan", status_code=201)
def create_plan(event_id: str):
    return services.create_plan(event_id)
