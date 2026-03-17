from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .service import ModerationService


async def get_moderation_service(
    common: dict = Depends(get_matchmaking_common),
) -> ModerationService:
    return ModerationService(**common)


__all__ = ["ModerationService", "get_moderation_service"]
