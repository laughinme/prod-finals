from fastapi import Depends

from database.relational_db import NotificationInterface, UserInterface, UoW, get_uow

from .service import UserNotificationsService


async def get_user_notifications_service(
    uow: UoW = Depends(get_uow),
) -> UserNotificationsService:
    return UserNotificationsService(
        uow=uow,
        user_repo=UserInterface(uow.session),
        notification_repo=NotificationInterface(uow.session),
    )


__all__ = ["UserNotificationsService", "get_user_notifications_service"]
