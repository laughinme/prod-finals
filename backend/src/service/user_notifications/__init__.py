from fastapi import Depends

from service.matchmaking.dependencies import get_matchmaking_common

from .service import UserNotificationsService


async def get_user_notifications_service(
    common: dict = Depends(get_matchmaking_common),
) -> UserNotificationsService:
    return UserNotificationsService(**common)


__all__ = ["UserNotificationsService", "get_user_notifications_service"]
