from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

from .config import settings
from .db import ensure_indexes
from .errors import AppError, app_error_handler, validation_error_handler
from .api import (
    health_router, household_router, events_router,
    plans_router, activity_router, assistant_router,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

# Build MCP app eagerly so session_manager is available before lifespan
from .mcp_server import mcp as _mcp_server
_mcp_app = _mcp_server.streamable_http_app(
    streamable_http_path="/",
    stateless_http=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup DB work
    if settings.MONGODB_URI:
        try:
            ensure_indexes()
            from .scripts_util import seed_household
            seed_household()
            logger.info("DB indexes ensured and household seeded")
        except Exception as e:
            logger.warning("Startup DB init failed (app still starts): %s", e)
    else:
        logger.warning("MONGODB_URI not set — running without database")

    # Run MCP session manager (sub-app lifespans do not run automatically)
    async with _mcp_server.session_manager.run():
        yield


app = FastAPI(
    title="HomeHalo API",
    version="1.0.0",
    description="AI home-safety coordination prototype — simulated events only.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

# API routes
app.include_router(health_router, prefix="/api")
app.include_router(household_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(plans_router, prefix="/api")
app.include_router(activity_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")

# Optional bearer auth for /mcp
if settings.MCP_AUTH_TOKEN:
    from starlette.middleware.base import BaseHTTPMiddleware

    class _BearerAuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            auth = request.headers.get("Authorization", "")
            if auth != f"Bearer {settings.MCP_AUTH_TOKEN}":
                return JSONResponse(
                    {"error": {"code": "unauthorized", "message": "Invalid MCP token. Note: full OAuth 2.1/PKCE is NOT implemented."}},
                    status_code=401,
                )
            return await call_next(request)

    _mcp_app.add_middleware(_BearerAuthMiddleware)

app.mount("/mcp", _mcp_app)
logger.info("MCP server mounted at /mcp (stateless_http=True)")
