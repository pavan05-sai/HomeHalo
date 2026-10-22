#!/usr/bin/env python
"""Seed the demo household. Safe to run multiple times."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# Load .env from backend/
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from backend.app.scripts_util import seed_household
from backend.app.db import ensure_indexes

ensure_indexes()
seed_household()
print("Seed complete — demo-household upserted.")
