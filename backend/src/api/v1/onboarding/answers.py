from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingAnswersRequest, OnboardingAnswersResponse
from service.onboarding import OnboardingService, get_onboarding_service

router = APIRouter()


@router.post(
    "/answers",
    response_model=OnboardingAnswersResponse,
    summary="Save onboarding filter answers",
)
async def post_onboarding_answers(
    payload: OnboardingAnswersRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingAnswersResponse:
    return await svc.save_answers(user, payload)
