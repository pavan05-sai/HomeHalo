from .health import router as health_router
from .household import router as household_router
from .events import router as events_router
from .plans import router as plans_router
from .activity import router as activity_router
from .assistant import router as assistant_router

__all__ = [
    "health_router",
    "household_router",
    "events_router",
    "plans_router",
    "activity_router",
    "assistant_router",
]
