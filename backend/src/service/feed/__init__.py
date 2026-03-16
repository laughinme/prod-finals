from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .interaction_service import InteractionService
from .service import FeedService


async def get_feed_service(common: dict = Depends(get_matchmaking_common)) -> FeedService:
    return FeedService(**common)


async def get_interaction_service(common: dict = Depends(get_matchmaking_common)) -> InteractionService:
    return InteractionService(**common)


__all__ = ["FeedService", "InteractionService", "get_feed_service", "get_interaction_service"]
