from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingConfigResponse
from service.dating import OnboardingService, get_onboarding_service

router = APIRouter()


@router.get(
    "/config",
    response_model=OnboardingConfigResponse,
    summary="Get optional onboarding quiz config",
)
async def get_onboarding_config(
    _: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingConfigResponse:
    return svc.get_config()
