from fastapi import APIRouter, Query
from typing import Optional
from ..models import StepDecisionRequest
from ..errors import ValidationError as AppValidationError
from .. import services

router = APIRouter()


@router.get("/plans")
def list_plans(
    event_id: Optional[str] = None,
    status: Optional[str] = None,
):
    return services.get_plans(event_id=event_id, status=status)


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str):
    return services.get_plan(plan_id)


@router.post("/plans/{plan_id}/steps/{step_id}/decision")
def step_decision(plan_id: str, step_id: str, body: StepDecisionRequest):
    if not body.confirmed:
        raise AppValidationError("confirmed must be true to record a decision")
    return services.log_step_decision(
        plan_id=plan_id,
        step_id=step_id,
        decision=body.decision,
        confirmed=body.confirmed,
        note=body.note,
        via="rest",
    )
