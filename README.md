# HomeHalo 🛡️

**AI Home-Safety Coordination Prototype**  
Built for the Amazon *"Build, Ship, Shape"* Hackathon (Alexa+ Track).

> ⚠️ **SAFETY DISCLAIMER**: HomeHalo operates on **SIMULATED events only**. It is an AI safety coordination prototype designed to demonstrate transparent risk assessment, evidence grounding, and human-in-the-loop decision-making. It is **not** a certified emergency dispatch system, medical alarm, or primary life-safety hardware. In a real emergency, always call 911 immediately.

---

## 💡 Concept & Architecture

HomeHalo addresses the critical challenge of autonomous home AI: **trust, transparency, and safety grounding**. Instead of allowing generative models to make ungrounded, probabilistic guesses during high-stakes safety events, HomeHalo employs a **dual-layer architecture**:

```
[Simulated Sensor / Event]
          │
          ▼
[Household Context Enrichment]  <── Mode (Home/Away/Sleeping), Schedules, Monitored Devices
          │
          ▼
[Deterministic Risk Engine]     <── Verifiable Rule IDs (e.g. RULE-DOOR-001, RULE-SMOKE-001)
          │
          ├──────────────────────────────┬──────────────────────────────┐
          ▼                              ▼                              ▼
 [Verified Known Facts]        [Missing Evidence / Unknowns]   [Response Plan Protocol]
          │                              │                              │
          └──────────────────────────────┴──────────────────────────────┘
                                         │
                                         ▼
                            [Human-in-the-Loop Decision]
                                         │
                                         ▼
                            [Immutable Audit Action Log]
                               (outcome: recorded_only)
```

1. **Deterministic Risk Assessment**: Core risk levels (`low`, `elevated`, `high`, `critical`) are computed via deterministic, auditable rules—never hallucinated by an LLM.
2. **Transparent Evidence Grounding**: Every assessment explicitly partitions context into **Verified Known Facts** and **Missing Evidence / Unknowns** (e.g., *"No motion sensor in backyard"*).
3. **Action Plans with Human Confirmation**: Proposed response actions require explicit resident approval or rejection. Decisions are logged with an immutable audit trail (`outcome: recorded_only`).
4. **Model Context Protocol (MCP)**: Native MCP endpoints mounted at `/mcp` expose tools (`record_safety_event`, `assess_safety_risk`, `generate_response_plan`, `decide_plan_step`, `query_household_context`) for agentic coordination.
5. **Context-Aware Safety Assistant**: Resident-facing natural language assistant grounded directly in verified household records.

---

## 🗂️ Project Structure

```
HomeHalo/
├── backend/
│   ├── app/
│   │   ├── api/             # REST API routers (household, events, plans, activity, assistant)
│   │   ├── assistant.py     # Deterministic context composition + LLM rewording
│   │   ├── config.py        # Environment settings (Pydantic Settings)
│   │   ├── db.py            # MongoDB Atlas connection & indexing
│   │   ├── errors.py        # Centralized typed error hierarchy
│   │   ├── main.py          # FastAPI application & MCP mount (/mcp)
│   │   ├── mcp_server.py    # MCP tools & server definition
│   │   ├── models.py        # Pydantic domain models
│   │   ├── plans.py         # Deterministic response plan generator
│   │   ├── rules.py         # Deterministic risk engine rules
│   │   ├── scripts_util.py  # Shared seed & helper routines
│   │   └── services.py      # Core business logic layer
│   ├── scripts/             # CLI utilities (seed.py, reset_demo.py, mcp_smoke.py)
│   └── tests/
│       ├── unit/            # Pure unit tests (35+ test suite, 0 DB dependency)
│       └── integration/     # Integration tests against test database
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Navbar, SimulationModal, Badges)
│   │   ├── lib/             # API client, types, utility functions
│   │   ├── pages/           # Dashboard, Events, EventDetail, Plans, Assistant, Activity
│   │   ├── App.tsx          # Root routing and state management
│   │   └── index.css        # Tailwind styling & Google Fonts
│   └── tests/
│       └── e2e/             # Playwright E2E browser tests
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.10+ (tested with 3.12)
- Node.js 18+ and npm
- (Optional) MongoDB Atlas account (free M0 cluster)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # Windows (or `source venv/bin/activate` on Unix)
pip install -r requirements.txt  # or run via pip inside venv

# Copy environment template
cp ../.env.example .env
```

To run unit tests (no database required):
```bash
pytest backend/tests/unit -v -m unit
```

To launch the FastAPI & MCP server:
```bash
uvicorn backend.app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- MCP Endpoint: `http://localhost:8000/mcp`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

To run production build check:
```bash
npm run build
```

---

## 🎯 Curated Demo Scenarios

You can trigger any scenario instantly via the **Simulate Event** modal:

1. **Night Door Opening (High Risk)**:
   - *Sensor*: Back Door opens at 2:15 AM while household is in `sleeping` mode.
   - *Assessment*: `RULE-DOOR-001` triggers high risk due to quiet hours breach without disarm code.
   - *Plan*: Generates resident safety verification and exterior floodlight check.

2. **Missed Senior Check-in (Elevated Risk)**:
   - *Event*: Grandma Rosa misses scheduled 10:00 AM check-in (+45 mins past grace period).
   - *Assessment*: `RULE-CHECKIN-001` triggers elevated risk.
   - *Plan*: Proposes warm automated prompt and secondary family member notification.

3. **Kitchen Smoke Alarm (Critical Risk)**:
   - *Sensor*: Smoke detector triggers while household mode is `away`.
   - *Assessment*: `RULE-SMOKE-001` triggers critical risk.
   - *Plan*: Generates immediate phone verification and emergency contact checklist.

---

## 🔒 Security & Privacy

- **No Live Sensor Access**: All inputs are explicitly marked `source: "simulated"`.
- **Action Guardrails**: Actions cannot alter physical state; they record audit confirmations (`outcome: recorded_only`).
- **Data Protection**: Household addresses and personal identifiable data are fictional demo entries (*The Rivera Household*).
