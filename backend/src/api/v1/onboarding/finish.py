from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingFinishResponse
from service.dating import OnboardingService, get_onboarding_service

router = APIRouter()


@router.post(
    "/finish",
    response_model=OnboardingFinishResponse,
    summary="Finish onboarding if minimal profile is complete",
)
async def finish_onboarding(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingFinishResponse:
    return await svc.finish(user)
