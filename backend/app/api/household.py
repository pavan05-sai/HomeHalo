from fastapi import APIRouter, Query
from ..models import PatchModeRequest
from .. import services

router = APIRouter()


@router.get("/household")
def get_household():
    return services.get_household()


@router.patch("/household/mode")
def patch_mode(body: PatchModeRequest):
    return services.patch_household_mode(body.mode.value)


@router.post("/household/reset")
def reset_household():
    return services.reset_demo_data()
