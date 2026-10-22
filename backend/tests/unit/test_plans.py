"""Unit tests for plans.py template builder."""
import pytest
from backend.app.plans import build_plan
from backend.app.models import RiskLevel

pytestmark = pytest.mark.unit

HOUSEHOLD = {
    "_id": "demo-household",
    "name": "Test Household",
    "mode": "away",
    "timezone": "UTC",
    "members": [{"id": "m1", "name": "Alice", "role": "adult"}],
    "devices": [
        {"id": "d1", "name": "Front Door", "type": "door_sensor", "location": "entrance"},
        {"id": "d2", "name": "Kitchen Smoke", "type": "smoke_alarm", "location": "kitchen"},
    ],
    "quiet_hours": {"start": "22:00", "end": "07:00"},
    "checkin_schedules": [],
    "emergency_number": "911",
}


def test_door_critical_plan_has_authority_step():
    plan = build_plan("ev1", "hh1", "door_activity", RiskLevel.critical, HOUSEHOLD, {"device_id": "d1", "activity": "opened"})
    assert plan["assessment_level"] == "critical"
    assert len(plan["steps"]) >= 2
    titles = [s["title"] for s in plan["steps"]]
    assert any("authorit" in t.lower() or "contacting" in t.lower() or "911" in t.lower() or "emergency" in t.lower() for t in titles)


def test_smoke_critical_plan_has_evacuate():
    plan = build_plan("ev2", "hh1", "smoke_alarm", RiskLevel.critical, HOUSEHOLD, {"device_id": "d2", "alarm_state": "sounding"})
    assert plan["assessment_level"] == "critical"
    texts = " ".join(s["title"] + s["detail"] for s in plan["steps"])
    assert "EVACUATE" in texts or "Leave" in texts or "evacuate" in texts.lower()


def test_smoke_test_plan_low():
    plan = build_plan("ev3", "hh1", "smoke_alarm", RiskLevel.low, HOUSEHOLD, {"device_id": "d2", "alarm_state": "test"})
    assert plan["assessment_level"] == "low"
    assert plan["steps"][0]["priority"] == "normal"


def test_checkin_plan_has_member_name():
    plan = build_plan("ev4", "hh1", "missed_checkin", RiskLevel.high, HOUSEHOLD, {"member_id": "m1", "expected_at": "2026-10-22T10:00:00Z"})
    text = " ".join(s["title"] + s["detail"] for s in plan["steps"])
    assert "Alice" in text


def test_plan_has_disclaimer():
    plan = build_plan("ev5", "hh1", "door_activity", RiskLevel.low, HOUSEHOLD, {"device_id": "d1", "activity": "opened"})
    assert "No real-world action" in plan["disclaimer"] or "advisory" in plan["disclaimer"]


def test_plan_source_is_rules():
    plan = build_plan("ev6", "hh1", "door_activity", RiskLevel.high, HOUSEHOLD, {"device_id": "d1", "activity": "opened"})
    assert plan["source"] == "rules"


def test_plan_step_ids_unique():
    plan = build_plan("ev7", "hh1", "smoke_alarm", RiskLevel.critical, HOUSEHOLD, {"device_id": "d2", "alarm_state": "sounding"})
    ids = [s["step_id"] for s in plan["steps"]]
    assert len(ids) == len(set(ids))
