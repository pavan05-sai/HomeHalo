#!/usr/bin/env python
"""
Reset demo events, plans, and action_logs.
Requires --confirm flag. NEVER touches the live homehalo DB.
"""
import sys, os, argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from backend.app.db import get_db
from backend.app.config import settings

parser = argparse.ArgumentParser()
parser.add_argument("--confirm", action="store_true", required=True)
args = parser.parse_args()

db_name = settings.MONGODB_DB
if not db_name.endswith("_test") and db_name != "homehalo":
    print(f"Unexpected DB name '{db_name}'. Aborting.")
    sys.exit(1)

db = get_db()
r1 = db["home_events"].delete_many({"household_id": "demo-household"})
r2 = db["response_plans"].delete_many({"household_id": "demo-household"})
r3 = db["action_logs"].delete_many({"household_id": "demo-household"})
print(f"Deleted: {r1.deleted_count} events, {r2.deleted_count} plans, {r3.deleted_count} action_logs")
