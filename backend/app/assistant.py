"""
Rule-based AI Safety Assistant.
Optionally rewrites the answer with an LLM if configured.
No factual data is invented; uses only retrieved records.
"""
from __future__ import annotations
from typing import Any, Optional
import re
import logging

logger = logging.getLogger(__name__)


def _intent(message: str) -> str:
    m = message.lower()
    if any(w in m for w in ["latest event", "recent event", "what happened", "last event"]):
        return "latest_events"
    if any(w in m for w in ["explain", "why", "what does", "assessment", "risk"]):
        return "explain_event"
    if any(w in m for w in ["status", "household", "mode", "who is home"]):
        return "household_status"
    if any(w in m for w in ["what should i do", "what to do", "next step", "recommend", "plan"]):
        return "what_to_do"
    if any(w in m for w in ["history", "action", "decision", "approved", "rejected"]):
        return "action_history"
    return "general"


def compose_answer(
    message: str,
    events: list[dict],
    household: Optional[dict],
    plans: list[dict],
    actions: list[dict],
    event_id: Optional[str] = None,
) -> dict:
    intent = _intent(message)
    sources: list[dict] = []
    unknowns: list[str] = []
    parts: list[str] = []

    if intent == "household_status":
        if household:
            parts.append(
                f"The household '{household.get('name', 'Unknown')}' is currently in "
                f"**{household.get('mode', 'unknown')}** mode. "
                f"It has {len(household.get('members', []))} members and "
                f"{len(household.get('devices', []))} devices."
            )
            sources.append({"collection": "households", "id": household.get("id", "")})
        else:
            unknowns.append("household data")
            parts.append("Household data is not available.")

    elif intent == "latest_events":
        if events:
            ev = events[0]
            parts.append(
                f"The latest event is a **{ev.get('event_type', 'unknown')}** recorded at "
                f"{ev.get('occurred_at', 'unknown')}. "
                f"Status: {ev.get('status', 'unknown')}."
            )
            assessment = ev.get("assessment")
            if assessment:
                parts.append(f"Risk level: **{assessment.get('level', 'unknown')}**. {assessment.get('explanation', '')}")
            else:
                unknowns.append("assessment for latest event")
            sources.append({"collection": "home_events", "id": ev.get("id", "")})
        else:
            unknowns.append("recent events")
            parts.append("No events have been recorded yet.")

    elif intent == "explain_event":
        target = None
        if event_id:
            target = next((e for e in events if e.get("id") == event_id), None)
        if not target and events:
            target = events[0]
        if target:
            a = target.get("assessment", {})
            if a:
                parts.append(
                    f"Event type: **{target.get('event_type')}**. "
                    f"Risk level: **{a.get('level', 'not assessed')}**.\n\n"
                    f"**Explanation:** {a.get('explanation', 'not recorded')}\n\n"
                    f"**Known facts:** {', '.join(a.get('known_facts', [])) or 'none recorded'}\n\n"
                    f"**Missing evidence:** {', '.join(a.get('missing_evidence', [])) or 'none'}\n\n"
                    f"**Rules applied:** {', '.join(a.get('rule_ids', [])) or 'none'}"
                )
                sources.append({"collection": "home_events", "id": target.get("id", "")})
            else:
                unknowns.append("assessment")
                parts.append(f"Event {target.get('id')} has not been assessed yet.")
        else:
            unknowns.append("event details")
            parts.append("No event found to explain.")

    elif intent == "what_to_do":
        if plans:
            plan = plans[0]
            steps = plan.get("steps", [])
            proposed = [s for s in steps if s.get("status") == "proposed"]
            parts.append(
                f"There is an open response plan: **{plan.get('summary', '')}**. "
                f"{len(proposed)} step(s) still need a decision."
            )
            for s in proposed[:3]:
                parts.append(f"- **{s.get('title')}**: {s.get('detail')}")
            sources.append({"collection": "response_plans", "id": plan.get("id", "")})
        else:
            unknowns.append("open response plans")
            parts.append("No open response plans found. Generate a plan from the Investigation screen first.")

    elif intent == "action_history":
        if actions:
            parts.append(f"There are {len(actions)} recorded action(s):")
            for a in actions[:5]:
                parts.append(
                    f"- Step `{a.get('step_id', '')}` was **{a.get('decision', '')}** at "
                    f"{a.get('decided_at', '')} via {a.get('via', '')}."
                )
            sources.append({"collection": "action_logs", "id": actions[0].get("id", "")})
        else:
            unknowns.append("action history")
            parts.append("No actions have been recorded yet.")

    else:
        parts.append(
            "I can help with: household status, latest events, explaining an event, "
            "what to do next, or action history. Ask me one of those!"
        )

    answer = "\n\n".join(parts)
    return {
        "answer": answer,
        "sources": sources,
        "unknowns": unknowns,
        "used_llm": False,
    }


def _validate_llm_output(output: str, evidence_bundle: dict) -> bool:
    """Reject if output contains numbers, times, names, IDs not in the evidence bundle."""
    bundle_text = str(evidence_bundle)
    # Extract numbers from output
    numbers_in_output = re.findall(r'\b\d+\b', output)
    for n in numbers_in_output:
        if n not in bundle_text:
            logger.warning("LLM validation failed: number %s not in evidence", n)
            return False
    return True


def maybe_reword_with_llm(answer: str, evidence_bundle: dict, settings_obj) -> tuple[str, bool]:
    """Optionally reword the template answer with an LLM. Returns (answer, used_llm)."""
    if settings_obj.LLM_PROVIDER == "none" or not settings_obj.LLM_API_KEY:
        return answer, False

    try:
        import httpx
        prompt = (
            "You are a home safety assistant. Reword the following answer using ONLY the "
            "evidence provided. Do not invent any numbers, times, names, or IDs not in the "
            "evidence bundle. Output only the reworded answer.\n\n"
            f"EVIDENCE:\n{evidence_bundle}\n\nANSWER TO REWORD:\n{answer}"
        )
        headers = {"Authorization": f"Bearer {settings_obj.LLM_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": settings_obj.LLM_MODEL or "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
        }
        base_url = "https://api.openai.com" if settings_obj.LLM_PROVIDER == "openai" else "https://api.openai.com"
        resp = httpx.post(
            f"{base_url}/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=settings_obj.LLM_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        reworded = resp.json()["choices"][0]["message"]["content"].strip()
        if _validate_llm_output(reworded, evidence_bundle):
            return reworded, True
        else:
            logger.warning("LLM output failed validation; using template answer")
            return answer, False
    except Exception as e:
        logger.warning("LLM call failed (%s); using template answer", e)
        return answer, False
