from __future__ import annotations
from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Optional, Literal, Any
from datetime import datetime, timezone
from enum import Enum


# ── Household ────────────────────────────────────────────────────────────────

class HouseholdMode(str, Enum):
    home = "home"
    away = "away"
    sleeping = "sleeping"


class HouseholdMember(BaseModel):
    id: str
    name: str
    role: str


class HouseholdDevice(BaseModel):
    id: str
    name: str
    type: str
    location: str


class QuietHours(BaseModel):
    start: str  # HH:MM
    end: str    # HH:MM


class CheckinSchedule(BaseModel):
    id: str
    member_id: str
    expected_time: str   # HH:MM
    grace_minutes: int


class Household(BaseModel):
    id: str = Field(alias="_id")
    name: str
    mode: HouseholdMode
    timezone: str
    members: list[HouseholdMember] = []
    devices: list[HouseholdDevice] = []
    quiet_hours: Optional[QuietHours] = None
    checkin_schedules: list[CheckinSchedule] = []
    is_demo: bool = True
    emergency_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


# ── Event Payloads ────────────────────────────────────────────────────────────

class DoorActivityPayload(BaseModel):
    model_config = {"extra": "forbid"}
    device_id: str
    activity: Literal["opened", "unlocked", "motion_detected", "left_open"]
    person_recognized: Optional[bool] = None


class MissedCheckinPayload(BaseModel):
    model_config = {"extra": "forbid"}
    member_id: str
    expected_at: datetime
    last_checkin_at: Optional[datetime] = None


class SmokeAlarmPayload(BaseModel):
    model_config = {"extra": "forbid"}
    device_id: str
    alarm_state: Literal["sounding", "cleared", "test"]
    smoke_or_flames_visible: Optional[bool] = None


# ── Assessment ────────────────────────────────────────────────────────────────

class RiskLevel(str, Enum):
    low = "low"
    elevated = "elevated"
    high = "high"
    critical = "critical"


LEVEL_ORDER = {RiskLevel.low: 0, RiskLevel.elevated: 1, RiskLevel.high: 2, RiskLevel.critical: 3}


class Assessment(BaseModel):
    level: RiskLevel
    rule_ids: list[str]
    known_facts: list[str]
    missing_evidence: list[str]
    inferred_risk: str
    related_event_ids: list[str] = []
    explanation: str
    engine_version: str = "1.0"
    assessed_at: datetime


# ── Home Events ───────────────────────────────────────────────────────────────

class EventType(str, Enum):
    door_activity = "door_activity"
    missed_checkin = "missed_checkin"
    smoke_alarm = "smoke_alarm"


class HomeEvent(BaseModel):
    id: str = Field(alias="_id")
    household_id: str
    event_type: EventType
    source: Literal["simulated"] = "simulated"
    occurred_at: datetime
    recorded_at: datetime
    payload: dict[str, Any]
    status: Literal["recorded", "assessed"] = "recorded"
    client_request_id: Optional[str] = None
    household_mode_at_event: Optional[str] = None
    assessment: Optional[Assessment] = None

    model_config = {"populate_by_name": True}


# ── Response Plans ────────────────────────────────────────────────────────────

class StepStatus(str, Enum):
    proposed = "proposed"
    approved = "approved"
    rejected = "rejected"


class StepPriority(str, Enum):
    urgent = "urgent"
    high = "high"
    normal = "normal"


class PlanStep(BaseModel):
    step_id: str
    order: int
    priority: StepPriority
    title: str
    detail: str
    kind: Literal["advice", "action"]
    requires_confirmation: bool
    status: StepStatus = StepStatus.proposed


class ResponsePlan(BaseModel):
    id: str = Field(alias="_id")
    household_id: str
    event_id: str
    assessment_level: RiskLevel
    summary: str
    steps: list[PlanStep]
    source: Literal["rules"] = "rules"
    disclaimer: str
    status: Literal["open", "closed"] = "open"
    created_at: datetime

    model_config = {"populate_by_name": True}


# ── Action Logs ───────────────────────────────────────────────────────────────

class ActionLog(BaseModel):
    id: str = Field(alias="_id")
    household_id: str
    event_id: str
    plan_id: str
    step_id: str
    decision: Literal["approved", "rejected"]
    outcome: Literal["recorded_only"] = "recorded_only"
    outcome_message: str
    via: Literal["rest", "mcp"]
    decided_at: datetime
    note: Optional[str] = None

    model_config = {"populate_by_name": True}


# ── API request/response helpers ──────────────────────────────────────────────

class RecordEventRequest(BaseModel):
    event_type: EventType
    payload: dict[str, Any]
    occurred_at: Optional[datetime] = None
    client_request_id: Optional[str] = None


class StepDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    confirmed: bool
    note: Optional[str] = Field(None, max_length=500)


class PatchModeRequest(BaseModel):
    mode: HouseholdMode


class ChatRequest(BaseModel):
    message: str
    event_id: Optional[str] = None
