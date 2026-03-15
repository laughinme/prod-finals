from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..conversations import Message
from ..users import User
from .notifications_table import MatchNotification, MessageNotification


class NotificationInterface:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_match_notification(
        self,
        *,
        user_id: UUID,
        match_id: UUID,
        conversation_id: UUID,
        peer_user_id: UUID,
    ) -> MatchNotification:
        notification = await self.get_match_notification(user_id=user_id, match_id=match_id)
        if notification is None:
            notification = MatchNotification(
                user_id=user_id,
                match_id=match_id,
                conversation_id=conversation_id,
                peer_user_id=peer_user_id,
            )
            self.session.add(notification)
            await self.session.flush()
        return notification

    async def get_match_notification(
        self,
        *,
        user_id: UUID,
        match_id: UUID,
    ) -> MatchNotification | None:
        return await self.session.scalar(
            select(MatchNotification).where(
                MatchNotification.user_id == user_id,
                MatchNotification.match_id == match_id,
            )
        )

    async def list_match_notifications_with_peers(
        self,
        *,
        user_id: UUID,
        unseen_only: bool,
        limit: int,
    ) -> list[tuple[MatchNotification, User]]:
        stmt = (
            select(MatchNotification, User)
            .join(User, User.id == MatchNotification.peer_user_id)
            .where(MatchNotification.user_id == user_id)
            .order_by(MatchNotification.created_at.desc())
            .limit(limit)
        )
        if unseen_only:
            stmt = stmt.where(MatchNotification.seen_at.is_(None))
        result = await self.session.execute(stmt)
        return list(result.all())

    async def count_unseen_match_notifications(self, *, user_id: UUID) -> int:
        count = await self.session.scalar(
            select(func.count(MatchNotification.id)).where(
                MatchNotification.user_id == user_id,
                MatchNotification.seen_at.is_(None),
            )
        )
        return int(count or 0)

    async def mark_match_notification_seen(
        self,
        *,
        user_id: UUID,
        notification_id: UUID,
        seen_at: datetime,
    ) -> MatchNotification | None:
        notification = await self.session.scalar(
            select(MatchNotification).where(
                MatchNotification.id == notification_id,
                MatchNotification.user_id == user_id,
            )
        )
        if notification is None:
            return None
        if notification.seen_at is None:
            notification.seen_at = seen_at
            await self.session.flush()
        return notification

    async def add_message_notification(
        self,
        *,
        user_id: UUID,
        match_id: UUID,
        conversation_id: UUID,
        message_id: UUID,
        sender_user_id: UUID,
    ) -> MessageNotification:
        notification = await self.get_message_notification(user_id=user_id, message_id=message_id)
        if notification is None:
            notification = MessageNotification(
                user_id=user_id,
                match_id=match_id,
                conversation_id=conversation_id,
                message_id=message_id,
                sender_user_id=sender_user_id,
            )
            self.session.add(notification)
            await self.session.flush()
        return notification

    async def get_message_notification(
        self,
        *,
        user_id: UUID,
        message_id: UUID,
    ) -> MessageNotification | None:
        return await self.session.scalar(
            select(MessageNotification).where(
                MessageNotification.user_id == user_id,
                MessageNotification.message_id == message_id,
            )
        )

    async def list_message_notifications_with_senders(
        self,
        *,
        user_id: UUID,
        unseen_only: bool,
        limit: int,
    ) -> list[tuple[MessageNotification, User, Message]]:
        stmt = (
            select(MessageNotification, User, Message)
            .join(User, User.id == MessageNotification.sender_user_id)
            .join(Message, Message.id == MessageNotification.message_id)
            .where(MessageNotification.user_id == user_id)
            .order_by(MessageNotification.created_at.desc())
            .limit(limit)
        )
        if unseen_only:
            stmt = stmt.where(MessageNotification.seen_at.is_(None))
        result = await self.session.execute(stmt)
        return list(result.all())

    async def count_unseen_message_notifications(self, *, user_id: UUID) -> int:
        count = await self.session.scalar(
            select(func.count(MessageNotification.id)).where(
                MessageNotification.user_id == user_id,
                MessageNotification.seen_at.is_(None),
            )
        )
        return int(count or 0)

    async def mark_message_notification_seen(
        self,
        *,
        user_id: UUID,
        notification_id: UUID,
        seen_at: datetime,
    ) -> MessageNotification | None:
        notification = await self.session.scalar(
            select(MessageNotification).where(
                MessageNotification.id == notification_id,
                MessageNotification.user_id == user_id,
            )
        )
        if notification is None:
            return None
        if notification.seen_at is None:
            notification.seen_at = seen_at
            await self.session.flush()
        return notification

    async def mark_conversation_message_notifications_read(
        self,
        *,
        user_id: UUID,
        conversation_id: UUID,
        read_at: datetime,
    ) -> int:
        result = await self.session.execute(
            update(MessageNotification)
            .where(
                MessageNotification.user_id == user_id,
                MessageNotification.conversation_id == conversation_id,
                MessageNotification.read_at.is_(None),
            )
            .values(
                read_at=read_at,
                seen_at=func.coalesce(MessageNotification.seen_at, read_at),
            )
        )
        await self.session.flush()
        return int(result.rowcount or 0)
