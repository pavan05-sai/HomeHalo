"""Unit tests for the AI Safety Assistant."""
import pytest
from backend.app.assistant import compose_answer, _validate_llm_output

pytestmark = pytest.mark.unit

HOUSEHOLD = {
    "id": "demo-household",
    "name": "Test House",
    "mode": "home",
    "members": [{"id": "m1", "name": "Alice", "role": "adult"}],
    "devices": [],
}

EVENT = {
    "id": "ev-1",
    "event_type": "door_activity",
    "occurred_at": "2026-10-22T10:00:00+00:00",
    "status": "assessed",
    "assessment": {
        "level": "high",
        "explanation": "Door opened while away.",
        "known_facts": ["activity=opened", "mode=away"],
        "missing_evidence": ["person_recognized not recorded"],
        "rule_ids": ["DOOR-01"],
    },
}

PLAN = {
    "id": "plan-1",
    "summary": "Response plan — high risk",
    "status": "open",
    "steps": [
        {"step_id": "s1", "title": "Review door", "detail": "Check camera", "status": "proposed"},
    ],
}

ACTION = {
    "id": "act-1",
    "step_id": "s1",
    "plan_id": "plan-1",
    "decision": "approved",
    "decided_at": "2026-10-22T10:05:00+00:00",
    "via": "rest",
}


def test_household_status_intent():
    result = compose_answer("What is the household status?", [], HOUSEHOLD, [], [])
    assert "home" in result["answer"]
    assert result["sources"]


def test_latest_events_intent():
    result = compose_answer("What was the latest event?", [EVENT], HOUSEHOLD, [], [])
    assert "door_activity" in result["answer"]
    assert result["sources"]


def test_explain_event_with_assessment():
    result = compose_answer("Explain this event", [EVENT], HOUSEHOLD, [], [], event_id="ev-1")
    assert "DOOR-01" in result["answer"]
    assert "high" in result["answer"]
    assert "person_recognized not recorded" in result["answer"]


def test_what_to_do_shows_plan():
    result = compose_answer("What should I do?", [EVENT], HOUSEHOLD, [PLAN], [])
    assert "Review door" in result["answer"] or "response plan" in result["answer"].lower()
    assert result["sources"]


def test_action_history_shows_decision():
    result = compose_answer("Show action history", [], HOUSEHOLD, [], [ACTION])
    assert "approved" in result["answer"]
    assert result["sources"]


def test_no_retrieval_no_factual_claim():
    """If no events, no invented answer — just guidance."""
    result = compose_answer("What happened?", [], HOUSEHOLD, [], [])
    assert "No events" in result["answer"] or "not recorded" in result["answer"].lower() or "unknowns" in str(result)


def test_llm_validation_rejects_invented_number():
    evidence = {"count": 3}
    # Output contains number 99 which isn't in evidence
    ok = _validate_llm_output("There were 99 events", evidence)
    assert not ok


def test_llm_validation_accepts_number_in_evidence():
    evidence = {"count": 42}
    ok = _validate_llm_output("There were 42 events", evidence)
    assert ok


def test_llm_failure_returns_template():
    """When LLM is disabled (provider=none), template answer is returned unchanged."""
    from unittest.mock import MagicMock
    from backend.app.assistant import maybe_reword_with_llm
    settings_mock = MagicMock()
    settings_mock.LLM_PROVIDER = "none"
    settings_mock.LLM_API_KEY = None
    answer, used_llm = maybe_reword_with_llm("template answer", {}, settings_mock)
    assert answer == "template answer"
    assert not used_llm
