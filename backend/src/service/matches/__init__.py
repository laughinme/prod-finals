from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .service import MatchService


async def get_match_service(
    common: dict = Depends(get_matchmaking_common),
) -> MatchService:
    return MatchService(**common)


__all__ = ["MatchService", "get_match_service"]
