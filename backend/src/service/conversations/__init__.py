from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .service import ConversationService


async def get_conversation_service(
    common: dict = Depends(get_matchmaking_common),
) -> ConversationService:
    return ConversationService(**common)


__all__ = ["ConversationService", "get_conversation_service"]
