from fastapi import APIRouter
from .. import services
from ..db import ping_db
from ..config import settings

router = APIRouter()


@router.get("/health")
def health():
    if not settings.MONGODB_URI:
        db_status = "not_configured"
    elif ping_db():
        db_status = "ok"
    else:
        db_status = "unavailable"
    return {"status": "ok", "database": db_status}
