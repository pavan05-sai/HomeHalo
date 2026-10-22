from __future__ import annotations
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from pymongo.errors import ServerSelectionTimeoutError
import logging
from .config import settings

logger = logging.getLogger(__name__)

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if not settings.MONGODB_URI:
            raise RuntimeError("MONGODB_URI not configured")
        _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db(db_name: str | None = None):
    name = db_name or settings.MONGODB_DB
    return get_client()[name]


def ensure_indexes(db_name: str | None = None) -> None:
    db = get_db(db_name)
    # home_events
    ev = db["home_events"]
    ev.create_index([("household_id", ASCENDING), ("occurred_at", DESCENDING)])
    ev.create_index([("household_id", ASCENDING), ("event_type", ASCENDING), ("occurred_at", DESCENDING)])
    ev.create_index(
        [("household_id", ASCENDING), ("client_request_id", ASCENDING)],
        unique=True,
        sparse=True,
        partialFilterExpression={"client_request_id": {"$exists": True}},
    )
    # response_plans
    rp = db["response_plans"]
    rp.create_index([("event_id", ASCENDING)], unique=True)
    rp.create_index([("household_id", ASCENDING), ("created_at", DESCENDING)])
    # action_logs
    al = db["action_logs"]
    al.create_index([("plan_id", ASCENDING), ("step_id", ASCENDING)], unique=True)
    al.create_index([("household_id", ASCENDING), ("decided_at", DESCENDING)])
    logger.info("MongoDB indexes ensured on %s", db_name or settings.MONGODB_DB)


def ping_db(db_name: str | None = None) -> bool:
    try:
        get_db(db_name).command("ping")
        return True
    except Exception:
        return False
