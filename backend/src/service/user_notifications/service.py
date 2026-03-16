from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from core.errors import BadRequestError, ForbiddenError, NotFoundError
from database.relational_db import Conversation, Match, PairState, User
from domain.dating import (
    AuditEntityType,
    ConversationStatus,
    FeedAction,
    FeedReactionResult,
    MatchLink,
    MatchStatus,
)
from domain.notifications import (
    LikeNotificationCardResponse,
    LikeNotificationItem,
    LikeNotificationReactionRequest,
    LikeNotificationReactionResponse,
    LikeNotificationsResponse,
    MarkNotificationSeenResponse,
    MatchNotificationItem,
    MatchNotificationsResponse,
    MessageNotificationItem,
    MessageNotificationsResponse,
    NotificationPeer,
)
from service.matchmaking import BaseDatingService, normalize_pair


class MatchNotificationNotFoundError(NotFoundError):
    error_code = "MATCH_NOTIFICATION_NOT_FOUND"
    default_detail = "Match notification not found"


class MessageNotificationNotFoundError(NotFoundError):
    error_code = "MESSAGE_NOTIFICATION_NOT_FOUND"
    default_detail = "Message notification not found"


class LikeNotificationNotFoundError(NotFoundError):
    error_code = "LIKE_NOTIFICATION_NOT_FOUND"
    default_detail = "Like notification not found"


class LikeNotificationUnavailableError(BadRequestError):
    error_code = "LIKE_NOTIFICATION_UNAVAILABLE"
    default_detail = "Like notification is no longer available"


class UserNotificationsService(BaseDatingService):
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
                    peer=NotificationPeer(
                        user_id=sender.id,
                        display_name=sender.resolved_display_name or "",
                        avatar_url=sender.avatar_url,
                    ),
                    preview_text=message_text,
                    created_at=notification.created_at,
                    seen_at=notification.seen_at,
                )
                for notification, sender, message_text in rows
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

    async def list_like_notifications(
        self,
        *,
        user: User,
        unseen_only: bool,
        limit: int,
    ) -> LikeNotificationsResponse:
        rows = await self.notification_repo.list_like_notifications_with_likers(
            user_id=user.id,
            unseen_only=unseen_only,
            limit=limit,
        )
        unseen_count = await self.notification_repo.count_unseen_like_notifications(user_id=user.id)
        return LikeNotificationsResponse(
            items=[
                LikeNotificationItem(
                    notification_id=notification.id,
                    liker_user_id=liker.id,
                    peer=NotificationPeer(
                        user_id=liker.id,
                        display_name=liker.resolved_display_name or "",
                        avatar_url=liker.avatar_url,
                    ),
                    created_at=notification.created_at,
                    seen_at=notification.seen_at,
                )
                for notification, liker in rows
            ],
            unseen_count=unseen_count,
        )

    async def mark_like_notification_seen(
        self,
        *,
        user: User,
        notification_id,
    ) -> MarkNotificationSeenResponse:
        notification = await self.notification_repo.mark_like_notification_seen(
            user_id=user.id,
            notification_id=notification_id,
            seen_at=datetime.now(UTC),
        )
        if notification is None:
            raise LikeNotificationNotFoundError()
        await self.uow.commit()
        return MarkNotificationSeenResponse(
            notification_id=notification.id,
            seen_at=notification.seen_at,
        )

    async def get_like_notification_card(
        self,
        *,
        user: User,
        notification_id,
    ) -> LikeNotificationCardResponse:
        notification = await self.notification_repo.get_like_notification(
            user_id=user.id,
            notification_id=notification_id,
        )
        if notification is None:
            raise LikeNotificationNotFoundError()
        liker = await self.user_repo.get_by_id(notification.liker_user_id)
        pair_state = await self.uow.session.get(PairState, notification.pair_state_id)
        if liker is None or pair_state is None or pair_state.status != "one_way_like":
            raise LikeNotificationUnavailableError()

        return LikeNotificationCardResponse(
            notification_id=notification.id,
            candidate={
                "user_id": liker.id,
                "display_name": liker.resolved_display_name or "",
                "age": liker.age,
                "city": liker.city.name if liker.city else None,
                "bio": liker.bio,
                "avatar_url": liker.avatar_url,
            },
            compatibility={
                "score": 0.72,
                "score_percent": 72,
                "preview": "Этот человек уже поставил вам лайк.",
                "reason_codes": ["like_received"],
                "category_breakdown": [],
            },
            actions={
                "can_like": user.can_like_profiles,
                "can_pass": True,
                "can_hide": True,
                "can_block": True,
                "can_report": True,
            },
        )

    async def react_to_like_notification(
        self,
        *,
        user: User,
        notification_id,
        payload: LikeNotificationReactionRequest,
    ) -> LikeNotificationReactionResponse:
        notification = await self.notification_repo.get_like_notification(
            user_id=user.id,
            notification_id=notification_id,
        )
        if notification is None:
            raise LikeNotificationNotFoundError()

        pair_state = await self.uow.session.get(PairState, notification.pair_state_id)
        peer = await self.user_repo.get_by_id(notification.liker_user_id)
        if pair_state is None or peer is None or pair_state.status != "one_way_like":
            raise LikeNotificationUnavailableError()

        if payload.action == FeedAction.LIKE and not user.can_like_profiles:
            raise ForbiddenError(
                "Photo is required before you can like profiles",
                error_code="PHOTO_REQUIRED_TO_LIKE",
                details={"reason": "photo_required_to_like"},
            )

        now = self.now()
        actor_slot = "low" if pair_state.user_low_id == user.id else "high"
        if actor_slot == "low":
            pair_state.low_action = payload.action.value
            pair_state.low_action_at = now
        else:
            pair_state.high_action = payload.action.value
            pair_state.high_action_at = now

        match_link = None
        result = FeedReactionResult.LIKED

        if payload.action == FeedAction.LIKE:
            match, conversation, created = await self._ensure_match(
                user_a_id=user.id,
                user_b_id=peer.id,
            )
            pair_state.status = "conversation_active"
            pair_state.match_id = match.id
            pair_state.conversation_id = conversation.id
            result = FeedReactionResult.MATCHED
            match_link = MatchLink(match_id=match.id, conversation_id=conversation.id)
            await self.notification_repo.delete_like_notification(
                user_id=user.id,
                liker_user_id=peer.id,
            )
            if created:
                await self.add_audit_event(
                    event_type="match_created",
                    entity_type=AuditEntityType.MATCH,
                    entity_id=str(match.id),
                    actor_user_id=user.id,
                    payload={
                        "peer_user_id": str(peer.id),
                        "decision_mode": match.source_decision_mode,
                        "source": "like_notification",
                    },
                )
                await self.increment_funnel_counter(
                    actor=user,
                    counter_name="match_created",
                    decision_mode=match.source_decision_mode,
                )
        elif payload.action == FeedAction.PASS:
            pair_state.status = "closed"
            pair_state.hidden_by_user_id = None
            await self.notification_repo.delete_like_notification(
                user_id=user.id,
                liker_user_id=peer.id,
            )
            result = FeedReactionResult.PASSED
        else:
            pair_state.status = "hidden"
            pair_state.hidden_by_user_id = user.id
            await self.notification_repo.delete_like_notification(
                user_id=user.id,
                liker_user_id=peer.id,
            )
            result = FeedReactionResult.HIDDEN

        await self.add_audit_event(
            event_type=f"like_notification_{payload.action.value}",
            entity_type=AuditEntityType.USER,
            entity_id=str(peer.id),
            actor_user_id=user.id,
            payload={"notification_id": str(notification.id)},
        )
        await self.uow.commit()
        return LikeNotificationReactionResponse(
            notification_id=notification.id,
            result=result,
            match=match_link,
            next_card_hint="next_available",
        )

    async def _ensure_match(
        self,
        *,
        user_a_id,
        user_b_id,
    ) -> tuple[Match, Conversation, bool]:
        existing = await self.matchmaking_repo.get_match_for_users(user_a_id, user_b_id)
        if existing is not None:
            conversation = await self.uow.session.scalar(select(Conversation).where(Conversation.match_id == existing.id))
            if conversation is None:
                conversation = await self.matchmaking_repo.add(
                    Conversation(match_id=existing.id, status=ConversationStatus.ACTIVE.value)
                )
                existing.conversation_id = conversation.id
                await self.uow.session.flush()
            return existing, conversation, False

        user_low_id, user_high_id = normalize_pair(user_a_id, user_b_id)
        match = await self.matchmaking_repo.add(
            Match(
                user_low_id=user_low_id,
                user_high_id=user_high_id,
                status=MatchStatus.ACTIVE.value,
                source_decision_mode="like_notification",
            )
        )
        conversation = await self.matchmaking_repo.add(
            Conversation(match_id=match.id, status=ConversationStatus.ACTIVE.value)
        )
        match.conversation_id = conversation.id
        await self.uow.session.flush()
        return match, conversation, True
