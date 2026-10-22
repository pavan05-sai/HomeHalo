"""
Deterministic risk-assessment rules.
All functions are pure; no I/O, no DB calls.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any
import zoneinfo

from .models import (
    RiskLevel, Assessment, LEVEL_ORDER,
    DoorActivityPayload, MissedCheckinPayload, SmokeAlarmPayload,
    EventType,
)


def _level_max(a: RiskLevel, b: RiskLevel) -> RiskLevel:
    return a if LEVEL_ORDER[a] >= LEVEL_ORDER[b] else b


def _cap(level: RiskLevel, cap: RiskLevel = RiskLevel.critical) -> RiskLevel:
    return level if LEVEL_ORDER[level] <= LEVEL_ORDER[cap] else cap


def _in_quiet_hours(now_local: datetime, start: str, end: str) -> bool:
    """Return True if now_local (naïve, local time) is inside [start, end) window."""
    sh, sm = map(int, start.split(":"))
    eh, em = map(int, end.split(":"))
    t = now_local.hour * 60 + now_local.minute
    s = sh * 60 + sm
    e = eh * 60 + em
    if s <= e:
        return s <= t < e
    else:  # wraps midnight
        return t >= s or t < e


def assess_door_activity(
    payload: dict[str, Any],
    household: dict[str, Any],
    occurred_at: datetime,
    related_events: list[dict[str, Any]],
) -> Assessment:
    p = DoorActivityPayload(**payload)
    mode = household.get("mode", "home")
    quiet_hours = household.get("quiet_hours")
    tz_name = household.get("timezone", "UTC")

    known_facts: list[str] = [
        f"activity={p.activity}",
        f"device_id={p.device_id}",
        f"mode={mode}",
    ]
    missing_evidence: list[str] = []
    rule_ids: list[str] = []

    if p.person_recognized is None:
        missing_evidence.append("person_recognized not recorded")
    else:
        known_facts.append(f"person_recognized={p.person_recognized}")

    recognized = p.person_recognized is True

    # DOOR rules
    if mode == "away":
        if not recognized:
            level = RiskLevel.high
            rule_ids.append("DOOR-01")
            inferred = "Unrecognized door activity while household is away."
        else:
            level = RiskLevel.low
            rule_ids.append("DOOR-02")
            inferred = "Recognized person; household away but expected activity."
    else:
        in_quiet = False
        if quiet_hours:
            try:
                tz = zoneinfo.ZoneInfo(tz_name)
                local_time = occurred_at.astimezone(tz)
                in_quiet = _in_quiet_hours(local_time, quiet_hours["start"], quiet_hours["end"])
                known_facts.append(f"in_quiet_hours={in_quiet}")
            except Exception:
                missing_evidence.append("Could not evaluate quiet hours (unknown timezone)")

        if in_quiet and not recognized:
            level = RiskLevel.elevated
            rule_ids.append("DOOR-03")
            inferred = "Unrecognized activity during quiet hours."
        else:
            level = RiskLevel.low
            rule_ids.append("DOOR-04")
            inferred = "Activity during normal hours; no immediate concern."

    # Correlation CORR-01: DOOR-01 + another unrecognized door within 30 min -> critical
    if "DOOR-01" in rule_ids:
        cutoff = occurred_at - timedelta(minutes=30)
        for re in related_events:
            if (
                re.get("event_type") == "door_activity"
                and re.get("assessment", {}).get("level") in ("high", "critical")
                and re.get("occurred_at") >= cutoff
            ):
                level = RiskLevel.critical
                rule_ids.append("CORR-01")
                inferred += " Correlated with another high-risk door event within 30 min."
                break

    # Correlation CORR-03: door high+ + smoke within 60 min -> critical
    if LEVEL_ORDER[level] >= LEVEL_ORDER[RiskLevel.high]:
        cutoff60 = occurred_at - timedelta(minutes=60)
        for re in related_events:
            if (
                re.get("event_type") == "smoke_alarm"
                and re.get("assessment", {}).get("level") in ("elevated", "high", "critical")
                and re.get("occurred_at") >= cutoff60
            ):
                level = RiskLevel.critical
                if "CORR-03" not in rule_ids:
                    rule_ids.append("CORR-03")
                inferred += " Correlated with recent smoke alarm — critical."
                break

    explanation = _door_explanation(level, rule_ids, p, mode)

    return Assessment(
        level=level,
        rule_ids=rule_ids,
        known_facts=known_facts,
        missing_evidence=missing_evidence,
        inferred_risk=inferred,
        related_event_ids=[str(r["_id"]) for r in related_events],
        explanation=explanation,
        assessed_at=datetime.now(timezone.utc),
    )


def _door_explanation(level: RiskLevel, rule_ids: list[str], p: DoorActivityPayload, mode: str) -> str:
    if level == RiskLevel.critical:
        return (
            "Multiple correlated high-risk signals detected. "
            "Consider reviewing recent activity carefully. "
            "HomeHalo cannot contact anyone or operate any device."
        )
    if level == RiskLevel.high:
        return (
            f"Door activity ({p.activity}) detected while household is in '{mode}' mode "
            "and the person was not recognized. This warrants attention."
        )
    if level == RiskLevel.elevated:
        return (
            f"Door activity ({p.activity}) during quiet hours with no recognized person. "
            "May be worth checking."
        )
    return f"Door activity ({p.activity}) — low concern given current context."


def assess_missed_checkin(
    payload: dict[str, Any],
    household: dict[str, Any],
    occurred_at: datetime,
    related_events: list[dict[str, Any]],
) -> Assessment:
    p = MissedCheckinPayload(**payload)
    known_facts: list[str] = [
        f"member_id={p.member_id}",
        f"expected_at={p.expected_at.isoformat()}",
    ]
    missing_evidence: list[str] = []
    rule_ids: list[str] = []

    # Find member name
    members = {m["id"]: m["name"] for m in household.get("members", [])}
    member_name = members.get(p.member_id, p.member_id)
    known_facts.append(f"member={member_name}")

    if p.last_checkin_at:
        known_facts.append(f"last_checkin_at={p.last_checkin_at.isoformat()}")
    else:
        missing_evidence.append("last_checkin_at not recorded")

    # Find grace from schedule
    grace = 15  # default
    for sched in household.get("checkin_schedules", []):
        if sched.get("member_id") == p.member_id:
            grace = sched.get("grace_minutes", 15)
            known_facts.append(f"grace_minutes={grace}")
            break

    # minutes_overdue computed from occurred_at - expected_at
    delta_minutes = (occurred_at - p.expected_at).total_seconds() / 60
    known_facts.append(f"minutes_overdue={delta_minutes:.1f}")

    if delta_minutes < grace:
        level = RiskLevel.low
        rule_ids.append("CHK-01")
        inferred = f"{member_name} is within grace period ({delta_minutes:.0f} min overdue, grace={grace} min)."
    elif delta_minutes < 60:
        level = RiskLevel.elevated
        rule_ids.append("CHK-02")
        inferred = f"{member_name} is {delta_minutes:.0f} min overdue (past grace, under 60 min)."
    else:
        level = RiskLevel.high
        rule_ids.append("CHK-03")
        inferred = f"{member_name} is {delta_minutes:.0f} min overdue (60+ min). Warrants attention."

    # CORR-02: concerning door or smoke within 120 min -> escalate one level, max critical
    cutoff = occurred_at - timedelta(minutes=120)
    for re in related_events:
        et = re.get("event_type")
        al = re.get("assessment", {}).get("level", "low")
        if (
            et in ("door_activity", "smoke_alarm")
            and al in ("elevated", "high", "critical")
            and re.get("occurred_at") >= cutoff
        ):
            old = level
            level = _cap(RiskLevel(list(LEVEL_ORDER.keys())[min(LEVEL_ORDER[level] + 1, 3)]))
            if "CORR-02" not in rule_ids:
                rule_ids.append("CORR-02")
            inferred += f" Escalated from {old.value} due to correlated door/smoke event."
            break

    explanation = (
        f"A missed check-in for {member_name} does not by itself confirm anything is wrong. "
        + inferred
        + " HomeHalo cannot contact anyone or operate any device."
    )

    return Assessment(
        level=level,
        rule_ids=rule_ids,
        known_facts=known_facts,
        missing_evidence=missing_evidence,
        inferred_risk=inferred,
        related_event_ids=[str(r["_id"]) for r in related_events],
        explanation=explanation,
        assessed_at=datetime.now(timezone.utc),
    )


def assess_smoke_alarm(
    payload: dict[str, Any],
    household: dict[str, Any],
    occurred_at: datetime,
    related_events: list[dict[str, Any]],
) -> Assessment:
    p = SmokeAlarmPayload(**payload)
    known_facts: list[str] = [
        f"device_id={p.device_id}",
        f"alarm_state={p.alarm_state}",
    ]
    missing_evidence: list[str] = []
    rule_ids: list[str] = []

    if p.smoke_or_flames_visible is None:
        missing_evidence.append("smoke_or_flames_visible not recorded")
    else:
        known_facts.append(f"smoke_or_flames_visible={p.smoke_or_flames_visible}")

    if p.alarm_state == "sounding":
        level = RiskLevel.critical
        rule_ids.append("SMOKE-01")
        inferred = "Smoke alarm sounding — critical alert always."
    elif p.alarm_state == "cleared":
        level = RiskLevel.elevated
        rule_ids.append("SMOKE-02")
        inferred = "Smoke alarm cleared. Situation may have resolved, but stay alert."
    else:  # test
        level = RiskLevel.low
        rule_ids.append("SMOKE-03")
        inferred = "Smoke alarm test mode. No immediate concern."

    # CORR-03 with door already assessed (inverse: smoke side)
    if LEVEL_ORDER[level] >= LEVEL_ORDER[RiskLevel.elevated]:
        cutoff60 = occurred_at - timedelta(minutes=60)
        for re in related_events:
            if (
                re.get("event_type") == "door_activity"
                and re.get("assessment", {}).get("level") in ("high", "critical")
                and re.get("occurred_at") >= cutoff60
            ):
                level = RiskLevel.critical
                if "CORR-03" not in rule_ids:
                    rule_ids.append("CORR-03")
                inferred += " Correlated with high-risk door activity — critical."
                break

    emergency_number = household.get("emergency_number")
    emergency_ref = f"Call {emergency_number}" if emergency_number else "Call your local emergency number"

    explanation = (
        "SMOKE ALARM GUIDANCE: Leave immediately with everyone present. "
        "Do not gather belongings or investigate. "
        "Close doors behind you if safe to do so. "
        "Stay out of the building. "
        f"{emergency_ref} from outside. "
        "HomeHalo cannot call anyone or operate any device. "
        f"Inferred: {inferred}"
    )

    return Assessment(
        level=level,
        rule_ids=rule_ids,
        known_facts=known_facts,
        missing_evidence=missing_evidence,
        inferred_risk=inferred,
        related_event_ids=[str(r["_id"]) for r in related_events],
        explanation=explanation,
        assessed_at=datetime.now(timezone.utc),
    )


def run_assessment(
    event_type: str,
    payload: dict[str, Any],
    household: dict[str, Any],
    occurred_at: datetime,
    related_events: list[dict[str, Any]],
) -> Assessment:
    """Entry point — dispatch to the correct assessor."""
    if event_type == EventType.door_activity:
        return assess_door_activity(payload, household, occurred_at, related_events)
    elif event_type == EventType.missed_checkin:
        return assess_missed_checkin(payload, household, occurred_at, related_events)
    elif event_type == EventType.smoke_alarm:
        return assess_smoke_alarm(payload, household, occurred_at, related_events)
    else:
        raise ValueError(f"Unknown event_type: {event_type}")
