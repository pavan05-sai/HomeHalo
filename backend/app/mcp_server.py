"""
MCP Server — five tools, all calling services.py.
Uses official MCP Python SDK v2.x (MCPServer, renamed from FastMCP).
"""
from __future__ import annotations
import logging
from typing import Any, Optional
from datetime import datetime, timezone
import functools

import anyio

logger = logging.getLogger(__name__)

from mcp.server.mcpserver import MCPServer

mcp = MCPServer(name="HomeHalo MCP")

# After mcp is created, we call streamable_http_app() once in main.py
# which initialises the session_manager.

# ── Tool helpers ──────────────────────────────────────────────────────────────

def _svc_error(code: str, msg: str) -> str:
    return f"{code}: {msg}"


async def _run(fn, *args, **kwargs):
    """Run a sync services function in a thread pool."""
    return await anyio.to_thread.run_sync(functools.partial(fn, *args, **kwargs))


# ── Tools ─────────────────────────────────────────────────────────────────────

@mcp.tool()
async def get_household_context() -> dict:
    """Get household info plus recent event count and latest 5 events."""
    from . import services
    from .errors import AppError
    try:
        household = await _run(services.get_household)
        events = await _run(services.get_events, 5)
        return {
            "household": household,
            "recent_event_count": len(events),
            "latest_events": events,
        }
    except AppError as e:
        raise ValueError(_svc_error(e.code, e.message))
    except Exception as e:
        raise ValueError(_svc_error("error", str(e)))


@mcp.tool()
async def record_home_event(
    event_type: str,
    payload: dict,
    occurred_at: Optional[str] = None,
    client_request_id: Optional[str] = None,
) -> dict:
    """Record a simulated home event. source is always forced to 'simulated'."""
    from . import services
    from .errors import AppError
    try:
        occ = None
        if occurred_at:
            occ = datetime.fromisoformat(occurred_at)
            if occ.tzinfo is None:
                occ = occ.replace(tzinfo=timezone.utc)
        result = await _run(
            services.record_event,
            event_type=event_type,
            payload=payload,
            occurred_at=occ,
            client_request_id=client_request_id,
        )
        return result
    except AppError as e:
        raise ValueError(_svc_error(e.code, e.message))
    except Exception as e:
        raise ValueError(_svc_error("error", str(e)))


@mcp.tool()
async def assess_event(event_id: str) -> dict:
    """Run deterministic rules on an event and store assessment."""
    from . import services
    from .errors import AppError
    try:
        return await _run(services.assess_event, event_id)
    except AppError as e:
        raise ValueError(_svc_error(e.code, e.message))
    except Exception as e:
        raise ValueError(_svc_error("error", str(e)))


@mcp.tool()
async def create_response_plan(event_id: str) -> dict:
    """Create a response plan for an assessed event. Returns existing plan if present."""
    from . import services
    from .errors import AppError
    try:
        return await _run(services.create_plan, event_id)
    except AppError as e:
        raise ValueError(_svc_error(e.code, e.message))
    except Exception as e:
        raise ValueError(_svc_error("error", str(e)))


@mcp.tool()
async def log_response_action(
    plan_id: str,
    step_id: str,
    decision: str,
    confirmed_by_user: bool,
    note: Optional[str] = None,
) -> dict:
    """Log a user decision on a plan step. confirmed_by_user must be true."""
    from . import services
    from .errors import AppError
    if not confirmed_by_user:
        raise ValueError(_svc_error("invalid_request", "confirmed_by_user must be true"))
    try:
        return await _run(
            services.log_step_decision,
            plan_id=plan_id,
            step_id=step_id,
            decision=decision,
            confirmed=confirmed_by_user,
            note=note,
            via="mcp",
        )
    except AppError as e:
        raise ValueError(_svc_error(e.code, e.message))
    except Exception as e:
        raise ValueError(_svc_error("error", str(e)))
