from datetime import UTC, datetime

from core.errors import NotFoundError
from database.relational_db import NotificationInterface, User, UserInterface, UoW
from domain.notifications import (
    MarkNotificationSeenResponse,
    MessageNotificationItem,
    MessageNotificationsResponse,
    MatchNotificationItem,
    MatchNotificationsResponse,
    NotificationPeer,
)


class MatchNotificationNotFoundError(NotFoundError):
    error_code = "MATCH_NOTIFICATION_NOT_FOUND"
    default_detail = "Match notification not found"


class MessageNotificationNotFoundError(NotFoundError):
    error_code = "MESSAGE_NOTIFICATION_NOT_FOUND"
    default_detail = "Message notification not found"


class UserNotificationsService:
    def __init__(
        self,
        *,
        uow: UoW,
        user_repo: UserInterface,
        notification_repo: NotificationInterface,
    ):
        self.uow = uow
        self.user_repo = user_repo
        self.notification_repo = notification_repo

    async def list_match_notifications(
        self,
        *,
        user: User,
        unseen_only: bool,
        limit: int,
    ) -> MatchNotificationsResponse:
        rows = await self.notification_repo.list_match_notifications_with_peers(
            user_id=user.id,
            unseen_only=unseen_only,
            limit=limit,
        )
        unseen_count = await self.notification_repo.count_unseen_match_notifications(user_id=user.id)
        return MatchNotificationsResponse(
            items=[
                MatchNotificationItem(
                    notification_id=notification.id,
                    match_id=notification.match_id,
                    conversation_id=notification.conversation_id,
                    peer=NotificationPeer(
                        user_id=peer.id,
                        display_name=peer.resolved_display_name or "",
                        avatar_url=peer.avatar_url,
                    ),
                    created_at=notification.created_at,
                    seen_at=notification.seen_at,
                )
                for notification, peer in rows
            ],
            unseen_count=unseen_count,
        )

    async def mark_match_notification_seen(
        self,
        *,
        user: User,
        notification_id,
    ) -> MarkNotificationSeenResponse:
        notification = await self.notification_repo.mark_match_notification_seen(
            user_id=user.id,
            notification_id=notification_id,
            seen_at=datetime.now(UTC),
        )
        if notification is None:
            raise MatchNotificationNotFoundError()
        await self.uow.commit()
        return MarkNotificationSeenResponse(
            notification_id=notification.id,
            seen_at=notification.seen_at,
        )

    async def list_message_notifications(
        self,
        *,
        user: User,
        unseen_only: bool,
        limit: int,
    ) -> MessageNotificationsResponse:
        rows = await self.notification_repo.list_message_notifications_with_senders(
            user_id=user.id,
            unseen_only=unseen_only,
            limit=limit,
        )
        unseen_count = await self.notification_repo.count_unseen_message_notifications(user_id=user.id)
        return MessageNotificationsResponse(
            items=[
                MessageNotificationItem(
                    notification_id=notification.id,
                    match_id=notification.match_id,
                    conversation_id=notification.conversation_id,
                    message_id=notification.message_id,
                    sender=NotificationPeer(
                        user_id=sender.id,
                        display_name=sender.resolved_display_name or "",
                        avatar_url=sender.avatar_url,
                    ),
                    text=message.text,
                    created_at=notification.created_at,
                    seen_at=notification.seen_at,
                    read_at=notification.read_at,
                )
                for notification, sender, message in rows
            ],
            unseen_count=unseen_count,
        )

    async def mark_message_notification_seen(
        self,
        *,
        user: User,
        notification_id,
    ) -> MarkNotificationSeenResponse:
        notification = await self.notification_repo.mark_message_notification_seen(
            user_id=user.id,
            notification_id=notification_id,
            seen_at=datetime.now(UTC),
        )
        if notification is None:
            raise MessageNotificationNotFoundError()
        await self.uow.commit()
        return MarkNotificationSeenResponse(
            notification_id=notification.id,
            seen_at=notification.seen_at,
        )
