"""
Response plan templates. Pure functions — no I/O.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
import uuid

from .models import (
    PlanStep, ResponsePlan, RiskLevel, StepPriority, StepStatus,
)

DISCLAIMER = (
    "This plan is advisory only. HomeHalo cannot perform any real-world action. "
    "All step outcomes are recorded only. No emergency services are contacted."
)


def _sid() -> str:
    return str(uuid.uuid4())[:8]


def _door_steps(level: RiskLevel, household: dict[str, Any], payload: dict[str, Any]) -> list[PlanStep]:
    device_id = payload.get("device_id", "unknown")
    devices = {d["id"]: d["name"] for d in household.get("devices", [])}
    device_name = devices.get(device_id, device_id)
    emergency = household.get("emergency_number", "your local emergency number")

    steps = []
    if level in (RiskLevel.high, RiskLevel.critical):
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.urgent,
            title="Review door activity",
            detail=f"Check the activity log for device '{device_name}'. Confirm whether you recognize the person.",
            kind="action", requires_confirmation=True,
        ))
        steps.append(PlanStep(
            step_id=_sid(), order=2, priority=StepPriority.urgent,
            title="Secure the home",
            detail="If the home is vacant, consider remotely verifying entry points via your own camera system.",
            kind="advice", requires_confirmation=False,
        ))
        if level == RiskLevel.critical:
            steps.append(PlanStep(
                step_id=_sid(), order=3, priority=StepPriority.urgent,
                title="Consider contacting authorities",
                detail=f"If you believe there is an intruder, call {emergency}. HomeHalo cannot do this for you.",
                kind="advice", requires_confirmation=False,
            ))
    elif level == RiskLevel.elevated:
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.high,
            title="Note door activity during quiet hours",
            detail=f"Door '{device_name}' showed activity during quiet hours. Verify this was expected.",
            kind="advice", requires_confirmation=False,
        ))
    else:
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.normal,
            title="Log noted",
            detail=f"Low-concern door activity on '{device_name}' recorded for your reference.",
            kind="advice", requires_confirmation=False,
        ))
    return steps


def _checkin_steps(level: RiskLevel, household: dict[str, Any], payload: dict[str, Any]) -> list[PlanStep]:
    member_id = payload.get("member_id", "unknown")
    members = {m["id"]: m["name"] for m in household.get("members", [])}
    member_name = members.get(member_id, member_id)
    emergency = household.get("emergency_number", "your local emergency number")

    steps = []
    if level == RiskLevel.critical:
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.urgent,
            title=f"Attempt to contact {member_name}",
            detail=f"Try reaching {member_name} directly. HomeHalo cannot make calls.",
            kind="advice", requires_confirmation=False,
        ))
        steps.append(PlanStep(
            step_id=_sid(), order=2, priority=StepPriority.urgent,
            title="Contact welfare services if unreachable",
            detail=f"If {member_name} cannot be reached, call {emergency} for a welfare check.",
            kind="advice", requires_confirmation=False,
        ))
    elif level == RiskLevel.high:
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.high,
            title=f"Attempt to contact {member_name}",
            detail=f"{member_name} is significantly overdue for check-in. Try calling or texting directly.",
            kind="advice", requires_confirmation=False,
        ))
    elif level == RiskLevel.elevated:
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.high,
            title=f"Check on {member_name}",
            detail=f"{member_name} has missed their expected check-in. Send a quick message.",
            kind="advice", requires_confirmation=False,
        ))
    else:
        steps.append(PlanStep(
            step_id=_sid(), order=1, priority=StepPriority.normal,
            title=f"Monitor {member_name} check-in",
            detail=f"{member_name} is within the grace period. No action needed yet.",
            kind="advice", requires_confirmation=False,
        ))
    return steps


def _smoke_steps(level: RiskLevel, household: dict[str, Any], payload: dict[str, Any]) -> list[PlanStep]:
    emergency = household.get("emergency_number", "your local emergency number")
    device_id = payload.get("device_id", "unknown")
    devices = {d["id"]: d["name"] for d in household.get("devices", [])}
    device_name = devices.get(device_id, device_id)

    if level == RiskLevel.critical:
        return [
            PlanStep(
                step_id=_sid(), order=1, priority=StepPriority.urgent,
                title="EVACUATE IMMEDIATELY",
                detail=(
                    "Leave immediately with everyone present. Do not gather belongings. "
                    "Close doors behind you if safe. Stay out."
                ),
                kind="advice", requires_confirmation=False,
            ),
            PlanStep(
                step_id=_sid(), order=2, priority=StepPriority.urgent,
                title=f"Call emergency services from outside",
                detail=f"From a safe location outside, call {emergency}. HomeHalo cannot make calls.",
                kind="advice", requires_confirmation=False,
            ),
            PlanStep(
                step_id=_sid(), order=3, priority=StepPriority.urgent,
                title="Acknowledge alarm",
                detail=f"Record that you have acknowledged the smoke alarm on device '{device_name}'.",
                kind="action", requires_confirmation=True,
            ),
        ]
    elif level == RiskLevel.elevated:
        return [
            PlanStep(
                step_id=_sid(), order=1, priority=StepPriority.high,
                title="Verify smoke alarm cleared",
                detail=f"Alarm on '{device_name}' is cleared. Ensure the area is safe before re-entering.",
                kind="advice", requires_confirmation=False,
            ),
        ]
    else:
        return [
            PlanStep(
                step_id=_sid(), order=1, priority=StepPriority.normal,
                title="Test acknowledged",
                detail=f"Smoke alarm test on '{device_name}' recorded. No action required.",
                kind="advice", requires_confirmation=False,
            ),
        ]


def build_plan(
    event_id: str,
    household_id: str,
    event_type: str,
    level: RiskLevel,
    household: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Return a plain dict suitable for MongoDB insert."""
    if event_type == "door_activity":
        steps = _door_steps(level, household, payload)
        summary = f"Response plan for door activity — {level.value} risk"
    elif event_type == "missed_checkin":
        steps = _checkin_steps(level, household, payload)
        summary = f"Response plan for missed check-in — {level.value} risk"
    elif event_type == "smoke_alarm":
        steps = _smoke_steps(level, household, payload)
        summary = f"Response plan for smoke alarm — {level.value} risk"
    else:
        steps = []
        summary = f"Response plan — {level.value} risk"

    now = datetime.now(timezone.utc)
    return {
        "_id": str(uuid.uuid4()),
        "household_id": household_id,
        "event_id": event_id,
        "assessment_level": level.value,
        "summary": summary,
        "steps": [s.model_dump() for s in steps],
        "source": "rules",
        "disclaimer": DISCLAIMER,
        "status": "open",
        "created_at": now,
    }
