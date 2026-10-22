from fastapi import APIRouter
from ..models import ChatRequest
from ..assistant import compose_answer, maybe_reword_with_llm
from ..config import settings
from .. import services

router = APIRouter()


@router.post("/assistant/chat")
def chat(body: ChatRequest):
    # Retrieve context
    try:
        household = services.get_household()
    except Exception:
        household = None
    events = services.get_events(limit=10)
    plans = services.get_plans(status="open")
    actions = services.get_actions()

    result = compose_answer(
        message=body.message,
        events=events,
        household=household,
        plans=plans,
        actions=actions,
        event_id=body.event_id,
    )

    # Optional LLM reword
    evidence_bundle = {
        "events": events[:3],
        "household": household,
        "plans": plans[:2],
        "actions": actions[:5],
    }
    answer, used_llm = maybe_reword_with_llm(result["answer"], evidence_bundle, settings)
    result["answer"] = answer
    result["used_llm"] = used_llm
    return result
