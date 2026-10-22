"""
Integration tests — require real MongoDB Atlas (MONGODB_DB_TEST collection).
Only drop collections if db name ends with _test.
Run with: pytest -m integration --tb=short
"""
import pytest
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

pytestmark = pytest.mark.integration

TEST_DB = os.getenv("MONGODB_DB_TEST", "homehalo_test")


@pytest.fixture(scope="module")
def db():
    """Return a real test DB and ensure indexes."""
    from backend.app.db import get_db, ensure_indexes, ping_db
    from backend.app.config import settings
    if not settings.MONGODB_URI:
        pytest.skip("MONGODB_URI not configured")
    assert TEST_DB.endswith("_test"), f"Safety check: DB must end with _test, got {TEST_DB}"
    try:
        ensure_indexes(TEST_DB)
    except Exception as e:
        pytest.skip(f"DB unavailable: {e}")
    _db = get_db(TEST_DB)
    # Clean up before tests
    _db["home_events"].delete_many({})
    _db["response_plans"].delete_many({})
    _db["action_logs"].delete_many({})
    from backend.app.scripts_util import seed_household
    seed_household(TEST_DB)
    yield _db
    # Teardown
    _db["home_events"].delete_many({})
    _db["response_plans"].delete_many({})
    _db["action_logs"].delete_many({})


def test_household_retrieval(db):
    from backend.app import services
    h = services.get_household(db_name=TEST_DB)
    assert h["id"] == "demo-household"
    assert h["name"] == "The Rivera Household"
    assert len(h["members"]) >= 1
    assert len(h["devices"]) >= 1


def test_event_validation_rejects_unknown_device(db):
    from backend.app import services
    from backend.app.errors import ValidationError as AppValidationError
    with pytest.raises(AppValidationError):
        services.record_event(
            event_type="door_activity",
            payload={"device_id": "non-existent", "activity": "opened"},
            db_name=TEST_DB,
        )


def test_event_validation_rejects_extra_fields(db):
    from backend.app import services
    from backend.app.errors import ValidationError as AppValidationError
    with pytest.raises(AppValidationError):
        services.record_event(
            event_type="door_activity",
            payload={"device_id": "dev-front-door", "activity": "opened", "unexpected_field": True},
            db_name=TEST_DB,
        )


def test_event_record_and_persist(db):
    from backend.app import services
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened", "person_recognized": False},
        db_name=TEST_DB,
    )
    assert ev["id"]
    assert ev["source"] == "simulated"
    assert ev["event_type"] == "door_activity"
    # Verify in DB
    raw = db["home_events"].find_one({"_id": ev["id"]})
    assert raw is not None


def test_event_idempotent_client_request_id(db):
    from backend.app import services
    ev1 = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened"},
        client_request_id="idem-test-001",
        db_name=TEST_DB,
    )
    ev2 = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened"},
        client_request_id="idem-test-001",
        db_name=TEST_DB,
    )
    assert ev1["id"] == ev2["id"]


def test_assess_event_stores_assessment(db):
    from backend.app import services
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened", "person_recognized": False},
        db_name=TEST_DB,
    )
    assessed = services.assess_event(ev["id"], db_name=TEST_DB)
    assert assessed["status"] == "assessed"
    assert assessed["assessment"]["level"] in ("low", "elevated", "high", "critical")
    assert assessed["assessment"]["rule_ids"]


def test_missing_evidence_not_invented(db):
    """person_recognized=None must appear in missing_evidence, not assumed."""
    from backend.app import services
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened"},  # no person_recognized
        db_name=TEST_DB,
    )
    assessed = services.assess_event(ev["id"], db_name=TEST_DB)
    missing = assessed["assessment"].get("missing_evidence", [])
    assert any("person_recognized" in m for m in missing)


def test_rule_outcome_away_unrecognized_is_high(db):
    from backend.app import services
    # Set household to away
    services.patch_household_mode("away", db_name=TEST_DB)
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened", "person_recognized": False},
        db_name=TEST_DB,
    )
    assessed = services.assess_event(ev["id"], db_name=TEST_DB)
    assert assessed["assessment"]["level"] in ("high", "critical")
    services.patch_household_mode("home", db_name=TEST_DB)


def test_plan_creation_and_idempotency(db):
    from backend.app import services
    ev = services.record_event(
        event_type="smoke_alarm",
        payload={"device_id": "dev-smoke-kitchen", "alarm_state": "sounding"},
        db_name=TEST_DB,
    )
    services.assess_event(ev["id"], db_name=TEST_DB)
    plan1 = services.create_plan(ev["id"], db_name=TEST_DB)
    plan2 = services.create_plan(ev["id"], db_name=TEST_DB)
    assert plan1["id"] == plan2["id"]
    assert plan1["assessment_level"] == "critical"


def test_approve_reject_logging(db):
    from backend.app import services
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-back-door", "activity": "opened"},
        db_name=TEST_DB,
    )
    services.assess_event(ev["id"], db_name=TEST_DB)
    plan = services.create_plan(ev["id"], db_name=TEST_DB)
    plan_id = plan["id"]
    step_id = plan["steps"][0]["step_id"]

    result = services.log_step_decision(plan_id, step_id, "approved", True, via="rest", db_name=TEST_DB)
    assert result["action_log"]["decision"] == "approved"
    assert result["action_log"]["outcome"] == "recorded_only"


def test_409_on_duplicate_decision(db):
    from backend.app import services
    from backend.app.errors import ConflictError
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-garage", "activity": "unlocked"},
        db_name=TEST_DB,
    )
    services.assess_event(ev["id"], db_name=TEST_DB)
    plan = services.create_plan(ev["id"], db_name=TEST_DB)
    plan_id = plan["id"]
    step_id = plan["steps"][0]["step_id"]

    services.log_step_decision(plan_id, step_id, "rejected", True, via="rest", db_name=TEST_DB)
    with pytest.raises(ConflictError):
        services.log_step_decision(plan_id, step_id, "approved", True, via="rest", db_name=TEST_DB)


def test_db_unreachable_gives_503():
    """With a bad URI, service should raise DatabaseUnavailableError."""
    from backend.app.errors import DatabaseUnavailableError
    from backend.app import db as db_module
    import backend.app.services as svc_module

    original = db_module._client
    try:
        from pymongo import MongoClient
        db_module._client = MongoClient("mongodb://localhost:27099", serverSelectionTimeoutMS=200)
        with pytest.raises(DatabaseUnavailableError):
            svc_module.get_household()
    finally:
        db_module._client = original


def test_plan_requires_assessed_event(db):
    from backend.app import services
    from backend.app.errors import InvalidRequestError
    ev = services.record_event(
        event_type="door_activity",
        payload={"device_id": "dev-front-door", "activity": "opened"},
        db_name=TEST_DB,
    )
    # Not assessed yet
    with pytest.raises(InvalidRequestError):
        services.create_plan(ev["id"], db_name=TEST_DB)
