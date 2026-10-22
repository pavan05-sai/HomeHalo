"""
services.py — the ONLY business logic layer.
All REST routes and MCP tools call these functions.
No direct DB access elsewhere.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import uuid
import logging

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from .config import settings
from .db import get_db
from .errors import (
    NotFoundError, ConflictError, ValidationError as AppValidationError,
    InvalidRequestError, DatabaseUnavailableError,
)
from .models import (
    EventType, DoorActivityPayload, MissedCheckinPayload, SmokeAlarmPayload,
    RiskLevel,
)
from .rules import run_assessment
from .plans import build_plan

logger = logging.getLogger(__name__)

HOUSEHOLD_ID = "demo-household"


def _db(db_name: str | None = None):
    try:
        db = get_db(db_name)
        db.command("ping")
        return db
    except ServerSelectionTimeoutError as e:
        raise DatabaseUnavailableError() from e
    except RuntimeError as e:
        raise DatabaseUnavailableError("MONGODB_URI not configured. Set it in .env") from e


def _serialize(doc: dict) -> dict:
    if doc is None:
        return doc
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _serialize(v)
        elif isinstance(v, list):
            out[k] = [_serialize(i) if isinstance(i, dict) else (i.isoformat() if isinstance(i, datetime) else i) for i in v]
        else:
            out[k] = v
    return out


def _validate_payload(event_type: str, payload: dict) -> None:
    try:
        if event_type == EventType.door_activity:
            DoorActivityPayload(**payload)
        elif event_type == EventType.missed_checkin:
            MissedCheckinPayload(**payload)
        elif event_type == EventType.smoke_alarm:
            SmokeAlarmPayload(**payload)
        else:
            raise AppValidationError(f"Unknown event_type: {event_type}")
    except Exception as e:
        raise AppValidationError(str(e))


def _validate_payload_refs(event_type: str, payload: dict, household: dict) -> None:
    device_ids = {d["id"] for d in household.get("devices", [])}
    member_ids = {m["id"] for m in household.get("members", [])}
    if event_type == EventType.door_activity:
        if payload.get("device_id") not in device_ids:
            raise AppValidationError(f"device_id '{payload.get('device_id')}' not found in household")
    elif event_type == EventType.missed_checkin:
        if payload.get("member_id") not in member_ids:
            raise AppValidationError(f"member_id '{payload.get('member_id')}' not found in household")
    elif event_type == EventType.smoke_alarm:
        if payload.get("device_id") not in device_ids:
            raise AppValidationError(f"device_id '{payload.get('device_id')}' not found in household")


# ── Household ─────────────────────────────────────────────────────────────────

def get_household(db_name: str | None = None) -> dict:
    db = _db(db_name)
    doc = db["households"].find_one({"_id": HOUSEHOLD_ID})
    if not doc:
        raise NotFoundError("Demo household not found. Run seed script.")
    return _serialize(doc)


def patch_household_mode(mode: str, db_name: str | None = None) -> dict:
    db = _db(db_name)
    if mode not in ("home", "away", "sleeping"):
        raise AppValidationError(f"Invalid mode: {mode}")
    doc = db["households"].find_one_and_update(
        {"_id": HOUSEHOLD_ID},
        {"$set": {"mode": mode, "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise NotFoundError("Demo household not found.")
    return _serialize(doc)


# ── Events ────────────────────────────────────────────────────────────────────

def record_event(
    event_type: str,
    payload: dict,
    occurred_at: Optional[datetime] = None,
    client_request_id: Optional[str] = None,
    db_name: str | None = None,
) -> dict:
    db = _db(db_name)
    # Validate event type
    if event_type not in [e.value for e in EventType]:
        raise AppValidationError(f"Invalid event_type: {event_type}")
    # Validate payload
    _validate_payload(event_type, payload)

    household = db["households"].find_one({"_id": HOUSEHOLD_ID})
    if not household:
        raise NotFoundError("Demo household not found.")
    _validate_payload_refs(event_type, payload, household)

    # Validate occurred_at
    now = datetime.now(timezone.utc)
    if occurred_at is None:
        occurred_at = now
    else:
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=timezone.utc)
        if occurred_at > now + timedelta(minutes=5):
            raise AppValidationError("occurred_at cannot be more than 5 minutes in the future")

    event_id = str(uuid.uuid4())
    doc = {
        "_id": event_id,
        "household_id": HOUSEHOLD_ID,
        "event_type": event_type,
        "source": "simulated",
        "occurred_at": occurred_at,
        "recorded_at": now,
        "payload": payload,
        "status": "recorded",
        "household_mode_at_event": household.get("mode", "home"),
        "created_at": now,
    }
    if client_request_id:
        doc["client_request_id"] = client_request_id

    try:
        db["home_events"].insert_one(doc)
    except DuplicateKeyError:
        # Idempotent: return existing
        existing = db["home_events"].find_one({"client_request_id": client_request_id, "household_id": HOUSEHOLD_ID})
        if existing:
            return _serialize(existing)
        raise ConflictError("Duplicate event")

    return _serialize(doc)


def get_events(
    limit: int = 50,
    event_type: Optional[str] = None,
    level: Optional[str] = None,
    db_name: str | None = None,
) -> list[dict]:
    db = _db(db_name)
    query: dict = {"household_id": HOUSEHOLD_ID}
    if event_type:
        query["event_type"] = event_type
    if level:
        query["assessment.level"] = level
    docs = list(db["home_events"].find(query, sort=[("occurred_at", -1)], limit=limit))
    return [_serialize(d) for d in docs]


def get_event(event_id: str, db_name: str | None = None) -> dict:
    db = _db(db_name)
    event = db["home_events"].find_one({"_id": event_id})
    if not event:
        raise NotFoundError(f"Event {event_id} not found")
    household = db["households"].find_one({"_id": HOUSEHOLD_ID})

    # Related events: same type within 2 hours
    occurred_at = event.get("occurred_at")
    if occurred_at:
        cutoff = occurred_at - timedelta(hours=2)
        related = list(db["home_events"].find({
            "household_id": HOUSEHOLD_ID,
            "_id": {"$ne": event_id},
            "occurred_at": {"$gte": cutoff},
        }, sort=[("occurred_at", -1)], limit=10))
    else:
        related = []

    return {
        "event": _serialize(event),
        "household": _serialize(household),
        "related_events": [_serialize(r) for r in related],
    }


def assess_event(event_id: str, db_name: str | None = None) -> dict:
    db = _db(db_name)
    event = db["home_events"].find_one({"_id": event_id})
    if not event:
        raise NotFoundError(f"Event {event_id} not found")

    household = db["households"].find_one({"_id": HOUSEHOLD_ID})
    if not household:
        raise NotFoundError("Demo household not found.")

    occurred_at = event["occurred_at"]
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)

    # Related events for correlation
    cutoff = occurred_at - timedelta(hours=2)
    related = list(db["home_events"].find({
        "household_id": HOUSEHOLD_ID,
        "_id": {"$ne": event_id},
        "occurred_at": {"$gte": cutoff},
        "assessment": {"$exists": True},
    }))
    # Make occurred_at timezone-aware in related events
    for r in related:
        if r.get("occurred_at") and r["occurred_at"].tzinfo is None:
            r["occurred_at"] = r["occurred_at"].replace(tzinfo=timezone.utc)

    assessment = run_assessment(
        event["event_type"], event["payload"], household, occurred_at, related
    )
    assessment_dict = assessment.model_dump()
    assessment_dict["assessed_at"] = assessment_dict["assessed_at"].isoformat() if isinstance(assessment_dict["assessed_at"], datetime) else assessment_dict["assessed_at"]
    assessment_dict["level"] = assessment_dict["level"].value if hasattr(assessment_dict["level"], "value") else assessment_dict["level"]

    db["home_events"].update_one(
        {"_id": event_id},
        {"$set": {"assessment": assessment_dict, "status": "assessed"}},
    )
    updated = db["home_events"].find_one({"_id": event_id})
    return _serialize(updated)


def create_plan(event_id: str, db_name: str | None = None) -> dict:
    db = _db(db_name)
    event = db["home_events"].find_one({"_id": event_id})
    if not event:
        raise NotFoundError(f"Event {event_id} not found")
    if event.get("status") != "assessed" or not event.get("assessment"):
        raise InvalidRequestError("Event must be assessed before creating a plan")

    # Idempotent
    existing = db["response_plans"].find_one({"event_id": event_id})
    if existing:
        return _serialize(existing)

    household = db["households"].find_one({"_id": HOUSEHOLD_ID})
    level = RiskLevel(event["assessment"]["level"])
    plan_doc = build_plan(
        event_id=event_id,
        household_id=HOUSEHOLD_ID,
        event_type=event["event_type"],
        level=level,
        household=household,
        payload=event["payload"],
    )
    try:
        db["response_plans"].insert_one(plan_doc)
    except DuplicateKeyError:
        existing = db["response_plans"].find_one({"event_id": event_id})
        return _serialize(existing)
    return _serialize(plan_doc)


def get_plans(
    event_id: Optional[str] = None,
    status: Optional[str] = None,
    db_name: str | None = None,
) -> list[dict]:
    db = _db(db_name)
    query: dict = {"household_id": HOUSEHOLD_ID}
    if event_id:
        query["event_id"] = event_id
    if status:
        query["status"] = status
    docs = list(db["response_plans"].find(query, sort=[("created_at", -1)]))
    return [_serialize(d) for d in docs]


def get_plan(plan_id: str, db_name: str | None = None) -> dict:
    db = _db(db_name)
    doc = db["response_plans"].find_one({"_id": plan_id})
    if not doc:
        raise NotFoundError(f"Plan {plan_id} not found")
    return _serialize(doc)


def log_step_decision(
    plan_id: str,
    step_id: str,
    decision: str,
    confirmed: bool,
    note: Optional[str] = None,
    via: str = "rest",
    db_name: str | None = None,
) -> dict:
    if not confirmed:
        raise AppValidationError("confirmed must be true to record a decision")
    if decision not in ("approved", "rejected"):
        raise AppValidationError("decision must be 'approved' or 'rejected'")

    db = _db(db_name)
    plan = db["response_plans"].find_one({"_id": plan_id})
    if not plan:
        raise NotFoundError(f"Plan {plan_id} not found")

    # Find the step
    step = next((s for s in plan.get("steps", []) if s["step_id"] == step_id), None)
    if not step:
        raise NotFoundError(f"Step {step_id} not found in plan {plan_id}")

    # Check idempotency / conflict
    existing_log = db["action_logs"].find_one({"plan_id": plan_id, "step_id": step_id})
    if existing_log:
        raise ConflictError("Decision already recorded for this step")

    now = datetime.now(timezone.utc)
    event_id = plan.get("event_id", "")
    log_doc = {
        "_id": str(uuid.uuid4()),
        "household_id": HOUSEHOLD_ID,
        "event_id": event_id,
        "plan_id": plan_id,
        "step_id": step_id,
        "decision": decision,
        "outcome": "recorded_only",
        "outcome_message": "Decision recorded. No real-world action was performed.",
        "via": via,
        "decided_at": now,
        "created_at": now,
    }
    if note:
        if len(note) > 500:
            raise AppValidationError("note must be 500 characters or fewer")
        log_doc["note"] = note

    try:
        db["action_logs"].insert_one(log_doc)
    except DuplicateKeyError:
        raise ConflictError("Decision already recorded for this step")

    # Update step status in plan
    db["response_plans"].update_one(
        {"_id": plan_id, "steps.step_id": step_id},
        {"$set": {"steps.$.status": decision}},
    )

    # Check if all steps are decided -> close plan
    updated_plan = db["response_plans"].find_one({"_id": plan_id})
    all_decided = all(
        s.get("status") in ("approved", "rejected")
        for s in updated_plan.get("steps", [])
    )
    if all_decided:
        db["response_plans"].update_one({"_id": plan_id}, {"$set": {"status": "closed"}})
        updated_plan["status"] = "closed"

    return {
        "action_log": _serialize(log_doc),
        "plan": _serialize(updated_plan),
    }


def get_actions(db_name: str | None = None) -> list[dict]:
    db = _db(db_name)
    docs = list(db["action_logs"].find(
        {"household_id": HOUSEHOLD_ID},
        sort=[("decided_at", -1)],
        limit=100,
    ))
    return [_serialize(d) for d in docs]


def get_summary(db_name: str | None = None) -> dict:
    db = _db(db_name)
    events = list(db["home_events"].find({"household_id": HOUSEHOLD_ID}))
    counts: dict[str, int] = {"low": 0, "elevated": 0, "high": 0, "critical": 0}
    for e in events:
        lvl = e.get("assessment", {}).get("level")
        if lvl in counts:
            counts[lvl] += 1

    open_plans = db["response_plans"].count_documents({"household_id": HOUSEHOLD_ID, "status": "open"})
    recent_events = list(db["home_events"].find(
        {"household_id": HOUSEHOLD_ID},
        sort=[("occurred_at", -1)],
        limit=5,
    ))
    return {
        "total_events": len(events),
        "by_level": counts,
        "open_plans": open_plans,
        "recent_events": [_serialize(e) for e in recent_events],
    }


def get_activity(limit: int = 50, kind: Optional[str] = None, db_name: str | None = None) -> list[dict]:
    db = _db(db_name)
    items: list[dict] = []

    if not kind or kind == "event":
        events = list(db["home_events"].find(
            {"household_id": HOUSEHOLD_ID},
            sort=[("occurred_at", -1)],
            limit=limit,
        ))
        for e in events:
            s = _serialize(e)
            s["_kind"] = "event"
            s["_ts"] = e["occurred_at"].isoformat() if isinstance(e.get("occurred_at"), datetime) else str(e.get("occurred_at", ""))
            items.append(s)

    if not kind or kind == "plan":
        plans = list(db["response_plans"].find(
            {"household_id": HOUSEHOLD_ID},
            sort=[("created_at", -1)],
            limit=limit,
        ))
        for p in plans:
            s = _serialize(p)
            s["_kind"] = "plan"
            s["_ts"] = p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else str(p.get("created_at", ""))
            items.append(s)

    if not kind or kind == "action":
        actions = list(db["action_logs"].find(
            {"household_id": HOUSEHOLD_ID},
            sort=[("decided_at", -1)],
            limit=limit,
        ))
        for a in actions:
            s = _serialize(a)
            s["_kind"] = "action"
            s["_ts"] = a["decided_at"].isoformat() if isinstance(a.get("decided_at"), datetime) else str(a.get("decided_at", ""))
            items.append(s)

    items.sort(key=lambda x: x.get("_ts", ""), reverse=True)
    return items[:limit]


def reset_demo_data(db_name: str | None = None) -> dict:
    db = _db(db_name)
    r1 = db["home_events"].delete_many({"household_id": HOUSEHOLD_ID})
    r2 = db["response_plans"].delete_many({"household_id": HOUSEHOLD_ID})
    r3 = db["action_logs"].delete_many({"household_id": HOUSEHOLD_ID})
    from .scripts_util import seed_household
    seed_household(db_name)
    return {
        "status": "reset",
        "deleted_events": r1.deleted_count,
        "deleted_plans": r2.deleted_count,
        "deleted_actions": r3.deleted_count,
    }
