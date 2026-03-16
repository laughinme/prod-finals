from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingStateResponse
from service.onboarding import OnboardingService, get_onboarding_service

router = APIRouter()


@router.post(
    "/skip",
    response_model=OnboardingStateResponse,
    summary="Skip onboarding for now",
)
async def post_onboarding_skip(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingStateResponse:
    return await svc.skip(user)
