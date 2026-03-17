from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.security import auth_user
from database.relational_db import User
from domain.notifications import (
    MarkNotificationSeenResponse,
    MatchNotificationsResponse,
)
from service.user_notifications import (
    UserNotificationsService,
    get_user_notifications_service,
)

router = APIRouter()


@router.get(
    "/matches",
    response_model=MatchNotificationsResponse,
    summary="List match notifications for current user",
)
async def get_match_notifications(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
    unseen_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
) -> MatchNotificationsResponse:
    return await svc.list_match_notifications(
        user=user, unseen_only=unseen_only, limit=limit
    )


@router.post(
    "/matches/{notification_id}/seen",
    response_model=MarkNotificationSeenResponse,
    summary="Mark match notification as seen",
)
async def mark_match_notification_seen(
    notification_id: UUID,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
) -> MarkNotificationSeenResponse:
    return await svc.mark_match_notification_seen(
        user=user, notification_id=notification_id
    )
