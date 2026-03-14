from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingStateResponse
from service.dating import OnboardingService, get_onboarding_service

router = APIRouter()


@router.get(
    "/state",
    response_model=OnboardingStateResponse,
    summary="Get onboarding state and next required step",
)
async def get_onboarding_state(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingStateResponse:
    return svc.get_state(user)
