from datetime import timedelta

from sqlalchemy import select

from database.relational_db import Conversation, InteractionEvent, Match, PairState, RecommendationItem, User
from domain.dating import (
    AuditEntityType,
    ConversationStatus,
    FeedAction,
    FeedReactionRequest,
    FeedReactionResponse,
    FeedReactionResult,
    MatchLink,
    MatchStatus,
    SafetySourceContext,
)
from domain.notifications import MatchCreatedEventPayload, NotificationPeer

from service.matchmaking import BaseDatingService, FeedItemNotFoundError, normalize_pair


class InteractionService(BaseDatingService):
    async def submit_reaction(
        self,
        *,
        user: User,
        serve_item_id,
        payload: FeedReactionRequest,
    ) -> FeedReactionResponse:
        item = await self.matchmaking_repo.get_recommendation_item_for_user(
            serve_item_id=serve_item_id,
            owner_user_id=user.id,
        )
        if item is None:
            raise FeedItemNotFoundError()

        existing = await self.matchmaking_repo.get_existing_interaction(
            actor_user_id=user.id,
            serve_item_id=item.id,
        )
        pair_state = await self.matchmaking_repo.get_or_create_pair_state(user.id, item.target_user_id)
        if existing is not None or item.processed_at is not None:
            return self._existing_reaction_response(item, pair_state)

        actor_slot = "low" if pair_state.user_low_id == user.id else "high"
        now = self.now()
        if actor_slot == "low":
            pair_state.low_action = payload.action.value
            pair_state.low_action_at = now
            counterpart_action = pair_state.high_action
        else:
            pair_state.high_action = payload.action.value
            pair_state.high_action_at = now
            counterpart_action = pair_state.low_action

        item.processed_at = now
        item.reaction_action = payload.action.value

        match_link = None
        notification_payload = None
        notification_user_id = None
        result = FeedReactionResult.LIKED
        if payload.action == FeedAction.LIKE and counterpart_action == FeedAction.LIKE.value:
            match, conversation = await self._ensure_match(user.id, item.target_user_id)
            pair_state.status = "conversation_active"
            pair_state.match_id = match.id
            pair_state.conversation_id = conversation.id
            result = FeedReactionResult.MATCHED
            match_link = MatchLink(match_id=match.id, conversation_id=conversation.id)
            notification_payload, notification_user_id = await self._build_match_notification(
                actor=user,
                peer_user_id=item.target_user_id,
                match=match,
                conversation=conversation,
            )
        elif payload.action == FeedAction.LIKE:
            pair_state.status = "one_way_like"
            result = FeedReactionResult.LIKED
        elif payload.action == FeedAction.PASS:
            pair_state.status = "closed"
            pair_state.cooldown_until = now + timedelta(days=self.cooldown_days)
            result = FeedReactionResult.PASSED
        else:
            pair_state.status = "hidden"
            pair_state.hidden_by_user_id = user.id
            result = FeedReactionResult.HIDDEN

        await self.matchmaking_repo.add(
            InteractionEvent(
                actor_user_id=user.id,
                target_user_id=item.target_user_id,
                serve_item_id=item.id,
                action=payload.action.value,
                source_context=SafetySourceContext.FEED.value,
            )
        )
        await self.add_audit_event(
            event_type=f"feed_{payload.action.value}",
            entity_type=AuditEntityType.FEED_ITEM,
            entity_id=str(item.id),
            actor_user_id=user.id,
            payload={
                "target_user_id": str(item.target_user_id),
                "opened_explanation": payload.opened_explanation,
                "opened_profile": payload.opened_profile,
                "dwell_time_ms": payload.dwell_time_ms,
            },
        )
        await self.add_outbox_event(
            topic="ml.interactions.swipe",
            payload={
                "actor_user_id": str(user.id),
                "target_user_id": str(item.target_user_id),
                "action": payload.action.value,
                "opened_explanation": payload.opened_explanation,
                "opened_profile": payload.opened_profile,
                "dwell_time_ms": payload.dwell_time_ms,
            },
        )
        await self.uow.commit()
        if notification_payload is not None and notification_user_id is not None:
            await self.realtime_service.publish_match_created(
                user_id=notification_user_id,
                payload=notification_payload,
            )

        return FeedReactionResponse(result=result, match=match_link, next_card_hint="next_available")

    async def _build_match_notification(
        self,
        *,
        actor: User,
        peer_user_id,
        match: Match,
        conversation: Conversation,
    ) -> tuple[MatchCreatedEventPayload, object]:
        notification = await self.notification_repo.add_match_notification(
            user_id=peer_user_id,
            match_id=match.id,
            conversation_id=conversation.id,
            peer_user_id=actor.id,
        )
        payload = MatchCreatedEventPayload(
            notification_id=notification.id,
            match_id=match.id,
            conversation_id=conversation.id,
            peer=NotificationPeer(
                user_id=actor.id,
                display_name=actor.resolved_display_name or "",
                avatar_url=actor.avatar_url,
            ),
            created_at=notification.created_at,
        )
        return payload, peer_user_id

    async def _ensure_match(self, user_a_id, user_b_id) -> tuple[Match, Conversation]:
        existing = await self.matchmaking_repo.get_match_for_users(user_a_id, user_b_id)
        if existing is not None:
            conversation = await self.uow.session.scalar(
                select(Conversation).where(Conversation.match_id == existing.id)
            )
            if conversation is None:
                conversation = await self.matchmaking_repo.add(
                    Conversation(match_id=existing.id, status=ConversationStatus.ACTIVE.value)
                )
                existing.conversation_id = conversation.id
                await self.uow.session.flush()
            return existing, conversation

        user_low_id, user_high_id = normalize_pair(user_a_id, user_b_id)
        match = await self.matchmaking_repo.add(
            Match(
                user_low_id=user_low_id,
                user_high_id=user_high_id,
                status=MatchStatus.ACTIVE.value,
            )
        )
        conversation = await self.matchmaking_repo.add(
            Conversation(match_id=match.id, status=ConversationStatus.ACTIVE.value)
        )
        match.conversation_id = conversation.id
        await self.uow.session.flush()
        return match, conversation

    def _existing_reaction_response(
        self,
        item: RecommendationItem,
        pair_state: PairState,
    ) -> FeedReactionResponse:
        action = item.reaction_action or pair_state.low_action or pair_state.high_action
        if action == FeedAction.LIKE.value and pair_state.match_id and pair_state.conversation_id:
            return FeedReactionResponse(
                result=FeedReactionResult.MATCHED,
                match=MatchLink(match_id=pair_state.match_id, conversation_id=pair_state.conversation_id),
                next_card_hint="next_available",
            )
        if action == FeedAction.PASS.value:
            return FeedReactionResponse(result=FeedReactionResult.PASSED, next_card_hint="next_available")
        if action == FeedAction.HIDE.value:
            return FeedReactionResponse(result=FeedReactionResult.HIDDEN, next_card_hint="next_available")
        return FeedReactionResponse(result=FeedReactionResult.LIKED, next_card_hint="next_available")
