"""Shared utility used by main.py lifespan and seed script."""
from __future__ import annotations
from datetime import datetime, timezone
from .db import get_db
from .config import settings


SEED_HOUSEHOLD = {
    "_id": "demo-household",
    "name": "The Rivera Household",
    "mode": "home",
    "timezone": "America/Chicago",
    "members": [
        {"id": "mem-001", "name": "Elena Rivera", "role": "adult"},
        {"id": "mem-002", "name": "Marco Rivera", "role": "adult"},
        {"id": "mem-003", "name": "Sofia Rivera", "role": "child"},
        {"id": "mem-004", "name": "Grandma Rosa", "role": "senior"},
    ],
    "devices": [
        {"id": "dev-front-door", "name": "Front Door Sensor", "type": "door_sensor", "location": "Front Entrance"},
        {"id": "dev-back-door", "name": "Back Door Sensor", "type": "door_sensor", "location": "Back Yard"},
        {"id": "dev-garage", "name": "Garage Door Sensor", "type": "door_sensor", "location": "Garage"},
        {"id": "dev-smoke-kitchen", "name": "Kitchen Smoke Alarm", "type": "smoke_alarm", "location": "Kitchen"},
        {"id": "dev-smoke-hall", "name": "Hallway Smoke Alarm", "type": "smoke_alarm", "location": "Main Hallway"},
    ],
    "quiet_hours": {"start": "22:00", "end": "07:00"},
    "checkin_schedules": [
        {"id": "cs-001", "member_id": "mem-004", "expected_time": "10:00", "grace_minutes": 30},
        {"id": "cs-002", "member_id": "mem-003", "expected_time": "15:30", "grace_minutes": 15},
    ],
    "emergency_number": "911",
    "notes": "Fictional household — demo data only. No real people or addresses.",
    "is_demo": True,
}


def seed_household(db_name: str | None = None) -> None:
    db = get_db(db_name)
    now = datetime.now(timezone.utc)
    doc = {**SEED_HOUSEHOLD, "created_at": now, "updated_at": now}
    db["households"].update_one(
        {"_id": "demo-household"},
        {"$setOnInsert": doc},
        upsert=True,
    )
