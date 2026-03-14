from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingStateResponse
from service.dating import OnboardingService, get_onboarding_service

router = APIRouter()


@router.post(
    "/resume",
    response_model=OnboardingStateResponse,
    summary="Resume optional onboarding quiz",
)
async def resume_onboarding(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingStateResponse:
    return await svc.resume(user)
