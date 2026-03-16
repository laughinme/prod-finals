from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import OnboardingEstimateRequest, OnboardingEstimateResponse
from service.onboarding import OnboardingService, get_onboarding_service

router = APIRouter()


@router.post(
    "/estimate",
    response_model=OnboardingEstimateResponse,
    summary="Estimate how many candidates fit the current onboarding answers",
)
async def post_onboarding_estimate(
    payload: OnboardingEstimateRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[OnboardingService, Depends(get_onboarding_service)],
) -> OnboardingEstimateResponse:
    return await svc.estimate(user, payload)
