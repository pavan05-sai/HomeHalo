"""Unit tests for all rule rows — pure functions, no DB."""
import pytest
from datetime import datetime, timezone, timedelta
from backend.app.rules import (
    assess_door_activity, assess_missed_checkin, assess_smoke_alarm, run_assessment
)
from backend.app.models import RiskLevel

pytestmark = pytest.mark.unit

NOW = datetime(2026, 10, 22, 14, 0, 0, tzinfo=timezone.utc)

HOUSEHOLD_AWAY = {
    "mode": "away",
    "timezone": "America/Chicago",
    "members": [{"id": "m1", "name": "Alice", "role": "adult"}],
    "devices": [{"id": "d1", "name": "Front Door", "type": "door_sensor", "location": "entrance"}],
    "quiet_hours": {"start": "22:00", "end": "07:00"},
    "checkin_schedules": [],
}

HOUSEHOLD_HOME = {**HOUSEHOLD_AWAY, "mode": "home"}
HOUSEHOLD_SLEEPING = {**HOUSEHOLD_AWAY, "mode": "sleeping"}


def door_payload(activity="opened", recognized=None):
    return {"device_id": "d1", "activity": activity, "person_recognized": recognized}


# DOOR-01: away, not recognized -> high
def test_door_01_high():
    a = assess_door_activity(door_payload(recognized=False), HOUSEHOLD_AWAY, NOW, [])
    assert a.level == RiskLevel.high
    assert "DOOR-01" in a.rule_ids


# DOOR-01: away, recognized=None also not recognized
def test_door_01_none_counts_as_not_recognized():
    a = assess_door_activity(door_payload(recognized=None), HOUSEHOLD_AWAY, NOW, [])
    assert a.level == RiskLevel.high
    assert "person_recognized not recorded" in a.missing_evidence


# DOOR-02: away, recognized true -> low
def test_door_02_low():
    a = assess_door_activity(door_payload(recognized=True), HOUSEHOLD_AWAY, NOW, [])
    assert a.level == RiskLevel.low
    assert "DOOR-02" in a.rule_ids


# DOOR-03: home, quiet hours, not recognized -> elevated
# quiet_hours 22:00-07:00; test at 23:00 UTC = 17:00 Chicago (not in quiet hours)
# Use 04:00 UTC = 22:00 CST -> quiet
def test_door_03_elevated():
    night_utc = datetime(2026, 10, 22, 4, 0, 0, tzinfo=timezone.utc)
    a = assess_door_activity(door_payload(recognized=False), HOUSEHOLD_HOME, night_utc, [])
    assert a.level == RiskLevel.elevated
    assert "DOOR-03" in a.rule_ids


# DOOR-04: home, daytime, low
def test_door_04_low():
    a = assess_door_activity(door_payload(recognized=False), HOUSEHOLD_HOME, NOW, [])
    assert a.level == RiskLevel.low
    assert "DOOR-04" in a.rule_ids


# CORR-01: DOOR-01 + another high door within 30min -> critical
def test_corr01_critical():
    prior = {
        "_id": "prior-1",
        "event_type": "door_activity",
        "occurred_at": NOW - timedelta(minutes=15),
        "assessment": {"level": "high"},
    }
    a = assess_door_activity(door_payload(recognized=False), HOUSEHOLD_AWAY, NOW, [prior])
    assert a.level == RiskLevel.critical
    assert "CORR-01" in a.rule_ids


# CORR-01 does NOT fire if prior event is too old (>30 min)
def test_corr01_no_fire_outside_window():
    prior = {
        "_id": "prior-2",
        "event_type": "door_activity",
        "occurred_at": NOW - timedelta(minutes=35),
        "assessment": {"level": "high"},
    }
    a = assess_door_activity(door_payload(recognized=False), HOUSEHOLD_AWAY, NOW, [prior])
    assert a.level == RiskLevel.high  # not escalated
    assert "CORR-01" not in a.rule_ids


# CORR-03: high door + smoke within 60 min -> critical
def test_corr03_critical():
    smoke = {
        "_id": "smoke-1",
        "event_type": "smoke_alarm",
        "occurred_at": NOW - timedelta(minutes=30),
        "assessment": {"level": "elevated"},
    }
    a = assess_door_activity(door_payload(recognized=False), HOUSEHOLD_AWAY, NOW, [smoke])
    assert a.level == RiskLevel.critical
    assert "CORR-03" in a.rule_ids


# CHK-01: within grace
def test_chk01_low():
    expected_at = NOW - timedelta(minutes=10)
    payload = {"member_id": "m1", "expected_at": expected_at.isoformat()}
    h = {**HOUSEHOLD_HOME, "checkin_schedules": [{"id": "cs1", "member_id": "m1", "expected_time": "10:00", "grace_minutes": 15}]}
    a = assess_missed_checkin(payload, h, NOW, [])
    assert a.level == RiskLevel.low
    assert "CHK-01" in a.rule_ids


# CHK-02: past grace, under 60
def test_chk02_elevated():
    expected_at = NOW - timedelta(minutes=40)
    payload = {"member_id": "m1", "expected_at": expected_at.isoformat()}
    h = {**HOUSEHOLD_HOME, "checkin_schedules": [{"id": "cs1", "member_id": "m1", "expected_time": "10:00", "grace_minutes": 15}]}
    a = assess_missed_checkin(payload, h, NOW, [])
    assert a.level == RiskLevel.elevated
    assert "CHK-02" in a.rule_ids


# CHK-03: 60+ minutes overdue
def test_chk03_high():
    expected_at = NOW - timedelta(minutes=75)
    payload = {"member_id": "m1", "expected_at": expected_at.isoformat()}
    a = assess_missed_checkin(payload, HOUSEHOLD_HOME, NOW, [])
    assert a.level == RiskLevel.high
    assert "CHK-03" in a.rule_ids


# CORR-02: CHK-02 + door high within 120 min -> escalate to high
def test_corr02_escalation():
    expected_at = NOW - timedelta(minutes=40)
    payload = {"member_id": "m1", "expected_at": expected_at.isoformat()}
    h = {**HOUSEHOLD_HOME, "checkin_schedules": [{"id": "cs1", "member_id": "m1", "expected_time": "10:00", "grace_minutes": 15}]}
    door_event = {
        "_id": "door-1",
        "event_type": "door_activity",
        "occurred_at": NOW - timedelta(minutes=60),
        "assessment": {"level": "high"},
    }
    a = assess_missed_checkin(payload, h, NOW, [door_event])
    assert a.level == RiskLevel.high  # elevated -> high
    assert "CORR-02" in a.rule_ids


# CORR-02 max cap at critical
def test_corr02_caps_at_critical():
    from backend.app.rules import _cap
    from backend.app.models import RiskLevel
    assert _cap(RiskLevel.critical) == RiskLevel.critical


# SMOKE-01: sounding -> critical always
def test_smoke01_critical():
    a = assess_smoke_alarm(
        {"device_id": "d1", "alarm_state": "sounding", "smoke_or_flames_visible": True},
        HOUSEHOLD_HOME, NOW, []
    )
    assert a.level == RiskLevel.critical
    assert "SMOKE-01" in a.rule_ids
    assert "EVACUATE" in a.explanation or "Leave" in a.explanation


# SMOKE-02: cleared -> elevated
def test_smoke02_elevated():
    a = assess_smoke_alarm({"device_id": "d1", "alarm_state": "cleared"}, HOUSEHOLD_HOME, NOW, [])
    assert a.level == RiskLevel.elevated
    assert "SMOKE-02" in a.rule_ids


# SMOKE-03: test -> low
def test_smoke03_low():
    a = assess_smoke_alarm({"device_id": "d1", "alarm_state": "test"}, HOUSEHOLD_HOME, NOW, [])
    assert a.level == RiskLevel.low
    assert "SMOKE-03" in a.rule_ids


# Missing evidence never assumed
def test_missing_evidence_not_assumed():
    a = assess_door_activity(door_payload(recognized=None), HOUSEHOLD_AWAY, NOW, [])
    assert "person_recognized not recorded" in a.missing_evidence
    # The level must not be low (it should still be high since none != True)
    assert a.level == RiskLevel.high


# Smoke missing evidence noted
def test_smoke_missing_evidence():
    a = assess_smoke_alarm({"device_id": "d1", "alarm_state": "sounding"}, HOUSEHOLD_HOME, NOW, [])
    assert "smoke_or_flames_visible not recorded" in a.missing_evidence


# run_assessment dispatcher
def test_run_assessment_dispatches():
    a = run_assessment("door_activity", door_payload(recognized=True), HOUSEHOLD_AWAY, NOW, [])
    assert a.level == RiskLevel.low

    a2 = run_assessment("smoke_alarm", {"device_id": "d1", "alarm_state": "sounding"}, HOUSEHOLD_HOME, NOW, [])
    assert a2.level == RiskLevel.critical
