from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.security import auth_user
from database.relational_db import User
from domain.notifications import (
    LikeNotificationCardResponse,
    LikeNotificationReactionRequest,
    LikeNotificationReactionResponse,
    LikeNotificationsResponse,
    MarkNotificationSeenResponse,
)
from service.user_notifications import UserNotificationsService, get_user_notifications_service

router = APIRouter()


@router.get(
    "/likes",
    response_model=LikeNotificationsResponse,
    summary="List like notifications for current user",
)
async def get_like_notifications(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
    unseen_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
) -> LikeNotificationsResponse:
    return await svc.list_like_notifications(user=user, unseen_only=unseen_only, limit=limit)


@router.post(
    "/likes/{notification_id}/seen",
    response_model=MarkNotificationSeenResponse,
    summary="Mark like notification as seen",
)
async def mark_like_notification_seen(
    notification_id: UUID,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
) -> MarkNotificationSeenResponse:
    return await svc.mark_like_notification_seen(user=user, notification_id=notification_id)


@router.get(
    "/likes/{notification_id}/card",
    response_model=LikeNotificationCardResponse,
    summary="Get profile card for like notification",
)
async def get_like_notification_card(
    notification_id: UUID,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
) -> LikeNotificationCardResponse:
    return await svc.get_like_notification_card(user=user, notification_id=notification_id)


@router.post(
    "/likes/{notification_id}/reaction",
    response_model=LikeNotificationReactionResponse,
    summary="React to a like notification",
)
async def react_to_like_notification(
    notification_id: UUID,
    payload: LikeNotificationReactionRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserNotificationsService, Depends(get_user_notifications_service)],
) -> LikeNotificationReactionResponse:
    return await svc.react_to_like_notification(
        user=user,
        notification_id=notification_id,
        payload=payload,
    )
