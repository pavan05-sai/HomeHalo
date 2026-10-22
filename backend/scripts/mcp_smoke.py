#!/usr/bin/env python
"""
MCP smoke test — runs the full workflow via real MCP tools over Streamable HTTP,
then verifies records via REST.
Usage (with app running):  python backend/scripts/mcp_smoke.py
"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")


async def main():
    import httpx
    from mcp.client import Client
    from mcp.client.streamable_http import streamable_http_client

    mcp_url = f"{BASE_URL}/mcp"
    print(f"Connecting to MCP at {mcp_url}")

    async with streamable_http_client(mcp_url) as transport:
        async with Client(transport) as client:
            # List tools
            tools_result = await client.list_tools()
            tool_names = [t.name for t in tools_result.tools]
            print(f"Tools ({len(tool_names)}): {tool_names}")
            assert len(tool_names) == 5, f"Expected 5 tools, got {len(tool_names)}: {tool_names}"

            # 1. Get household context
            r = await client.call_tool("get_household_context", {})
            ctx_text = r.content[0].text if r.content else "{}"
            ctx = json.loads(ctx_text) if ctx_text.strip().startswith("{") else {}
            print(f"Household: {ctx.get('household', {}).get('name', 'unknown')}")

            # 2. Record event
            r2 = await client.call_tool("record_home_event", {
                "event_type": "door_activity",
                "payload": {
                    "device_id": "dev-front-door",
                    "activity": "opened",
                    "person_recognized": False,
                },
                "client_request_id": "smoke-test-002",
            })
            event_text = r2.content[0].text
            event = json.loads(event_text)
            event_id = event.get("id") or event.get("_id")
            print(f"Recorded event: {event_id}")
            assert event_id, "event_id must be set"

            # 3. Assess event
            r3 = await client.call_tool("assess_event", {"event_id": event_id})
            assessed = json.loads(r3.content[0].text)
            level = assessed.get("assessment", {}).get("level")
            print(f"Assessment level: {level}")
            assert level in ("low", "elevated", "high", "critical"), f"unexpected level: {level}"

            # 4. Create plan
            r4 = await client.call_tool("create_response_plan", {"event_id": event_id})
            plan = json.loads(r4.content[0].text)
            plan_id = plan.get("id") or plan.get("_id")
            steps = plan.get("steps", [])
            print(f"Plan {plan_id} with {len(steps)} steps")
            assert steps, "Plan must have at least one step"

            # 5. Log action
            step_id = steps[0]["step_id"]
            r5 = await client.call_tool("log_response_action", {
                "plan_id": plan_id,
                "step_id": step_id,
                "decision": "approved",
                "confirmed_by_user": True,
                "note": "Smoke test auto-approval",
            })
            action_result = json.loads(r5.content[0].text)
            action_id = action_result.get("action_log", {}).get("id")
            print(f"Action logged: {action_id}")
            assert action_id, "action_id must be set"

    # Verify via REST
    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        resp = await http.get(f"/api/events/{event_id}")
        assert resp.status_code == 200, f"Event not found via REST: {resp.text}"

        resp2 = await http.get(f"/api/plans/{plan_id}")
        assert resp2.status_code == 200, f"Plan not found via REST: {resp2.text}"

        resp3 = await http.get("/api/actions")
        actions = resp3.json()
        assert any(a.get("via") == "mcp" for a in actions), "No MCP action found in /api/actions"

    print("\n✅ MCP smoke test PASSED")


asyncio.run(main())
