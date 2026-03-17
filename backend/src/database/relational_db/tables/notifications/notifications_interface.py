from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..conversations import Message
from ..users import User
from .notifications_table import (
    LikeNotification,
    MatchNotification,
    MessageNotification,
)


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
        notification = await self.get_match_notification(
            user_id=user_id, match_id=match_id
        )
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
        notification = await self.session.scalar(
            select(MessageNotification).where(
                MessageNotification.user_id == user_id,
                MessageNotification.message_id == message_id,
            )
        )
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

    async def list_message_notifications_with_senders(
        self,
        *,
        user_id: UUID,
        unseen_only: bool,
        limit: int,
    ) -> list[tuple[MessageNotification, User, str]]:
        stmt = (
            select(MessageNotification, User, Message.text)
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

    async def mark_conversation_notifications_read(
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

    async def add_like_notification(
        self,
        *,
        user_id: UUID,
        liker_user_id: UUID,
        pair_state_id: UUID,
    ) -> LikeNotification:
        notification = await self.session.scalar(
            select(LikeNotification).where(
                LikeNotification.user_id == user_id,
                LikeNotification.pair_state_id == pair_state_id,
            )
        )
        if notification is None:
            notification = LikeNotification(
                user_id=user_id,
                liker_user_id=liker_user_id,
                pair_state_id=pair_state_id,
            )
            self.session.add(notification)
            await self.session.flush()
        return notification

    async def get_like_notification(
        self, *, user_id: UUID, notification_id: UUID
    ) -> LikeNotification | None:
        return await self.session.scalar(
            select(LikeNotification).where(
                LikeNotification.id == notification_id,
                LikeNotification.user_id == user_id,
            )
        )

    async def get_like_notification_by_pair_state(
        self,
        *,
        user_id: UUID,
        pair_state_id: UUID,
    ) -> LikeNotification | None:
        return await self.session.scalar(
            select(LikeNotification).where(
                LikeNotification.user_id == user_id,
                LikeNotification.pair_state_id == pair_state_id,
            )
        )

    async def delete_like_notification(
        self,
        *,
        user_id: UUID,
        liker_user_id: UUID,
    ) -> None:
        notification = await self.session.scalar(
            select(LikeNotification).where(
                LikeNotification.user_id == user_id,
                LikeNotification.liker_user_id == liker_user_id,
            )
        )
        if notification is not None:
            await self.session.delete(notification)
            await self.session.flush()

    async def delete_like_notifications_for_pair_state(
        self, *, pair_state_id: UUID
    ) -> None:
        await self.session.execute(
            delete(LikeNotification).where(
                LikeNotification.pair_state_id == pair_state_id
            )
        )
        await self.session.flush()

    async def delete_match_notifications_for_match(self, *, match_id: UUID) -> None:
        await self.session.execute(
            delete(MatchNotification).where(MatchNotification.match_id == match_id)
        )
        await self.session.flush()

    async def delete_message_notifications_for_conversation(
        self, *, conversation_id: UUID
    ) -> None:
        await self.session.execute(
            delete(MessageNotification).where(
                MessageNotification.conversation_id == conversation_id
            )
        )
        await self.session.flush()

    async def list_like_notifications_with_likers(
        self,
        *,
        user_id: UUID,
        unseen_only: bool,
        limit: int,
    ) -> list[tuple[LikeNotification, User]]:
        stmt = (
            select(LikeNotification, User)
            .join(User, User.id == LikeNotification.liker_user_id)
            .where(LikeNotification.user_id == user_id)
            .order_by(LikeNotification.created_at.desc())
            .limit(limit)
        )
        if unseen_only:
            stmt = stmt.where(LikeNotification.seen_at.is_(None))
        result = await self.session.execute(stmt)
        return list(result.all())

    async def list_active_like_liker_user_ids(
        self,
        *,
        user_id: UUID,
        limit: int = 100,
    ) -> list[UUID]:
        rows = await self.session.scalars(
            select(LikeNotification.liker_user_id)
            .where(LikeNotification.user_id == user_id)
            .order_by(LikeNotification.created_at.desc())
            .limit(limit)
        )
        return list(rows.all())

    async def count_unseen_like_notifications(self, *, user_id: UUID) -> int:
        count = await self.session.scalar(
            select(func.count(LikeNotification.id)).where(
                LikeNotification.user_id == user_id,
                LikeNotification.seen_at.is_(None),
            )
        )
        return int(count or 0)

    async def mark_like_notification_seen(
        self,
        *,
        user_id: UUID,
        notification_id: UUID,
        seen_at: datetime,
    ) -> LikeNotification | None:
        notification = await self.get_like_notification(
            user_id=user_id, notification_id=notification_id
        )
        if notification is None:
            return None
        if notification.seen_at is None:
            notification.seen_at = seen_at
            await self.session.flush()
        return notification

    async def count_unread_messages_by_match(self, *, user_id: UUID) -> dict[UUID, int]:
        rows = await self.session.execute(
            select(MessageNotification.match_id, func.count(MessageNotification.id))
            .where(
                MessageNotification.user_id == user_id,
                MessageNotification.read_at.is_(None),
            )
            .group_by(MessageNotification.match_id)
        )
        return {match_id: int(count) for match_id, count in rows.all()}
