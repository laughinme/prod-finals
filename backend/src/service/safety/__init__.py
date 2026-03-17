from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .service import SafetyService


async def get_safety_service(
    common: dict = Depends(get_matchmaking_common),
) -> SafetyService:
    return SafetyService(**common)


__all__ = ["SafetyService", "get_safety_service"]
