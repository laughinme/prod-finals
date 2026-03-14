from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .service import OnboardingService


async def get_onboarding_service(common: dict = Depends(get_matchmaking_common)) -> OnboardingService:
    return OnboardingService(**common)


__all__ = ["OnboardingService", "get_onboarding_service"]
