from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.security import auth_user
from database.relational_db import User
from domain.notifications import (
    MarkNotificationSeenResponse,
    MessageNotificationsResponse,
)
from service.user_notifications import (
    UserNotificationsService,
    get_user_notifications_service,
)

router = APIRouter()


@router.get(
    "/messages",
    response_model=MessageNotificationsResponse,
    summary="List message notifications for current user",
)
async def get_message_notifications(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
    unseen_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
) -> MessageNotificationsResponse:
    return await svc.list_message_notifications(
        user=user, unseen_only=unseen_only, limit=limit
    )


@router.post(
    "/messages/{notification_id}/seen",
    response_model=MarkNotificationSeenResponse,
    summary="Mark message notification as seen",
)
async def mark_message_notification_seen(
    notification_id: UUID,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
) -> MarkNotificationSeenResponse:
    return await svc.mark_message_notification_seen(
        user=user, notification_id=notification_id
    )
