from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingStateResponse
from service.onboarding import OnboardingService, get_onboarding_service

router = APIRouter()


@router.get(
    "/state",
    response_model=OnboardingStateResponse,
    summary="Get current onboarding progress state",
)
async def get_onboarding_state(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingStateResponse:
    return await svc.get_state(user)
