from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from core.errors import ForbiddenError
from database.relational_db import (
    Conversation,
    InteractionEvent,
    Match,
    PairState,
    RecommendationItem,
    User,
)
from domain.dating import (
    AuditEntityType,
    ConversationStatus,
    FeedAction,
    FeedReactionRequest,
    FeedReactionResponse,
    FeedReactionResult,
    FeedTestMatchResponse,
    MatchLink,
    MatchStatus,
    SafetySourceContext,
)
from domain.notifications import (
    LikeReceivedEventPayload,
    MatchCreatedEventPayload,
    NotificationPeer,
)

from service.matchmaking import (
    BaseDatingService,
    FeedItemAlreadyProcessedError,
    FeedItemNotFoundError,
    normalize_pair,
)


class InteractionService(BaseDatingService):
    async def arm_test_match(
        self,
        *,
        user: User,
        serve_item_id,
    ) -> FeedTestMatchResponse:
        if not self.settings.FEED_TEST_MATCH_ENABLED:
            raise ForbiddenError("Test match mode is disabled")

        item = await self.matchmaking_repo.get_recommendation_item_for_user(
            serve_item_id=serve_item_id,
            owner_user_id=user.id,
        )
        if item is None:
            raise FeedItemNotFoundError()
        if item.processed_at is not None:
            raise FeedItemAlreadyProcessedError()

        pair_state = await self.matchmaking_repo.get_or_create_pair_state(
            user.id, item.target_user_id
        )
        now = self.now()
        actor_slot = "low" if pair_state.user_low_id == user.id else "high"

        if actor_slot == "low":
            pair_state.high_action = FeedAction.LIKE.value
            pair_state.high_action_at = now
        else:
            pair_state.low_action = FeedAction.LIKE.value
            pair_state.low_action_at = now

        pair_state.status = "one_way_like"
        pair_state.cooldown_until = None
        pair_state.hidden_by_user_id = None

        await self.add_audit_event(
            event_type="feed_test_match_armed",
            entity_type=AuditEntityType.FEED_ITEM,
            entity_id=str(item.id),
            actor_user_id=user.id,
            payload={
                "target_user_id": str(item.target_user_id),
                "message": "Swipe right to complete a mutual match.",
            },
        )
        await self.uow.commit()

        return FeedTestMatchResponse(
            message="Тестовый мэтч подготовлен. Свайпните вправо, чтобы случился мэтч обоих.",
        )

    async def submit_reaction(
        self,
        *,
        user: User,
        serve_item_id,
        payload: FeedReactionRequest,
    ) -> FeedReactionResponse:
        if payload.action == FeedAction.LIKE and not user.can_like_profiles:
            raise ForbiddenError(
                "Photo is required before you can like profiles",
                error_code="PHOTO_REQUIRED_TO_LIKE",
                details={"reason": "photo_required_to_like"},
            )

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
        batch = await self.matchmaking_repo.get_recommendation_batch(item.batch_id)
        decision_mode = batch.decision_mode if batch is not None else None
        pair_state = await self.matchmaking_repo.get_or_create_pair_state(
            user.id, item.target_user_id
        )
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
        like_notification_payload = None
        like_notification_user_id = None
        result = FeedReactionResult.LIKED
        if (
            payload.action == FeedAction.LIKE
            and counterpart_action == FeedAction.LIKE.value
        ):
            match, conversation, match_created = await self._ensure_match(
                user.id,
                item.target_user_id,
                source_decision_mode=decision_mode,
            )
            pair_state.status = "conversation_active"
            pair_state.match_id = match.id
            pair_state.conversation_id = conversation.id
            result = FeedReactionResult.MATCHED
            match_link = MatchLink(match_id=match.id, conversation_id=conversation.id)
            await self.notification_repo.delete_like_notification(
                user_id=user.id,
                liker_user_id=item.target_user_id,
            )
            (
                notification_payload,
                notification_user_id,
            ) = await self._build_match_notification(
                actor=user,
                peer_user_id=item.target_user_id,
                match=match,
                conversation=conversation,
            )
            if match_created:
                await self.add_audit_event(
                    event_type="match_created",
                    entity_type=AuditEntityType.MATCH,
                    entity_id=str(match.id),
                    actor_user_id=user.id,
                    payload={
                        "peer_user_id": str(item.target_user_id),
                        "decision_mode": decision_mode,
                    },
                )
                await self.increment_funnel_counter(
                    actor=user,
                    counter_name="match_created",
                    decision_mode=decision_mode,
                )
        elif payload.action == FeedAction.LIKE:
            pair_state.status = "one_way_like"
            result = FeedReactionResult.LIKED
            (
                like_notification_payload,
                like_notification_user_id,
            ) = await self._build_like_notification(
                actor=user,
                peer_user_id=item.target_user_id,
                pair_state=pair_state,
            )
        elif payload.action == FeedAction.PASS:
            pair_state.status = "closed"
            pair_state.cooldown_until = now + timedelta(days=self.cooldown_days)
            await self.notification_repo.delete_like_notification(
                user_id=user.id,
                liker_user_id=item.target_user_id,
            )
            result = FeedReactionResult.PASSED
        else:
            pair_state.status = "hidden"
            pair_state.hidden_by_user_id = user.id
            await self.notification_repo.delete_like_notification(
                user_id=user.id,
                liker_user_id=item.target_user_id,
            )
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
        await self.increment_funnel_counter(
            actor=user,
            counter_name=f"feed_{payload.action.value}",
            decision_mode=decision_mode,
        )
        target_user = await self.user_repo.get_by_id(item.target_user_id)
        actor_ml_id = user.service_user_id or str(user.id)
        target_ml_id = (target_user.service_user_id if target_user else None) or str(
            item.target_user_id
        )
        await self.add_outbox_event(
            topic="ml.interactions.swipe",
            payload={
                "actor_user_id": actor_ml_id,
                "target_user_id": target_ml_id,
                "action": payload.action.value,
                "opened_explanation": payload.opened_explanation,
                "opened_profile": payload.opened_profile,
                "dwell_time_ms": payload.dwell_time_ms,
            },
        )
        if match_link is not None:
            await self.add_outbox_event(
                topic="ml.interactions.match_outcome",
                payload={
                    "match_id": str(match_link.match_id),
                    "user_a_id": actor_ml_id,
                    "user_b_id": target_ml_id,
                    "outcome": "match_created",
                    "happened_at": now.isoformat(),
                },
            )
        try:
            await self.uow.commit()
        except IntegrityError:
            # Parallel duplicate reaction requests can race on unique constraints.
            await self.uow.rollback()
            latest_item = await self.matchmaking_repo.get_recommendation_item_for_user(
                serve_item_id=serve_item_id,
                owner_user_id=user.id,
            )
            latest_pair_state = await self.matchmaking_repo.get_pair_state(
                user.id, item.target_user_id
            )
            if latest_item is not None and latest_pair_state is not None:
                return self._existing_reaction_response(latest_item, latest_pair_state)
            raise
        if notification_payload is not None and notification_user_id is not None:
            await self.realtime_service.publish_match_created(
                user_id=notification_user_id,
                payload=notification_payload,
            )
        if (
            like_notification_payload is not None
            and like_notification_user_id is not None
        ):
            await self.realtime_service.publish_like_received(
                user_id=like_notification_user_id,
                payload=like_notification_payload,
            )

        return FeedReactionResponse(
            result=result, match=match_link, next_card_hint="next_available"
        )

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

    async def _build_like_notification(
        self,
        *,
        actor: User,
        peer_user_id,
        pair_state: PairState,
    ) -> tuple[LikeReceivedEventPayload, object]:
        notification = await self.notification_repo.add_like_notification(
            user_id=peer_user_id,
            liker_user_id=actor.id,
            pair_state_id=pair_state.id,
        )
        payload = LikeReceivedEventPayload(
            notification_id=notification.id,
            liker_user_id=actor.id,
            peer=NotificationPeer(
                user_id=actor.id,
                display_name=actor.resolved_display_name or "",
                avatar_url=actor.avatar_url,
            ),
            created_at=notification.created_at,
        )
        return payload, peer_user_id

    async def _ensure_match(
        self,
        user_a_id,
        user_b_id,
        *,
        source_decision_mode: str | None,
    ) -> tuple[Match, Conversation, bool]:
        existing = await self.matchmaking_repo.get_match_for_users(user_a_id, user_b_id)
        if existing is not None:
            conversation = await self.uow.session.scalar(
                select(Conversation).where(Conversation.match_id == existing.id)
            )
            if conversation is None:
                conversation = await self.matchmaking_repo.add(
                    Conversation(
                        match_id=existing.id, status=ConversationStatus.ACTIVE.value
                    )
                )
                existing.conversation_id = conversation.id
                await self.uow.session.flush()
            if (
                existing.source_decision_mode is None
                and source_decision_mode is not None
            ):
                existing.source_decision_mode = source_decision_mode
                await self.uow.session.flush()
            return existing, conversation, False

        user_low_id, user_high_id = normalize_pair(user_a_id, user_b_id)
        match = await self.matchmaking_repo.add(
            Match(
                user_low_id=user_low_id,
                user_high_id=user_high_id,
                status=MatchStatus.ACTIVE.value,
                source_decision_mode=source_decision_mode,
            )
        )
        conversation = await self.matchmaking_repo.add(
            Conversation(match_id=match.id, status=ConversationStatus.ACTIVE.value)
        )
        match.conversation_id = conversation.id
        await self.uow.session.flush()
        return match, conversation, True

    def _existing_reaction_response(
        self,
        item: RecommendationItem,
        pair_state: PairState,
    ) -> FeedReactionResponse:
        action = item.reaction_action or pair_state.low_action or pair_state.high_action
        if (
            action == FeedAction.LIKE.value
            and pair_state.match_id
            and pair_state.conversation_id
        ):
            return FeedReactionResponse(
                result=FeedReactionResult.MATCHED,
                match=MatchLink(
                    match_id=pair_state.match_id,
                    conversation_id=pair_state.conversation_id,
                ),
                next_card_hint="next_available",
            )
        if action == FeedAction.PASS.value:
            return FeedReactionResponse(
                result=FeedReactionResult.PASSED, next_card_hint="next_available"
            )
        if action == FeedAction.HIDE.value:
            return FeedReactionResponse(
                result=FeedReactionResult.HIDDEN, next_card_hint="next_available"
            )
        return FeedReactionResponse(
            result=FeedReactionResult.LIKED, next_card_hint="next_available"
        )
