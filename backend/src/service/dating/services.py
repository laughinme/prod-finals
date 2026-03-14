from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from core.config import Settings, get_settings
from database.relational_db import (
    AuditLog,
    Block,
    Conversation,
    DatingInterface,
    InteractionEvent,
    Match,
    Message,
    OutboxEvent,
    PairState,
    RecommendationBatch,
    RecommendationItem,
    Report,
    UoW,
    User,
    UserInterface,
)
from domain.dating import (
    AgeRange,
    AuditEntityType,
    AuditEvent,
    AuditEventsResponse,
    AuditEventsQuery,
    BlockReasonCode,
    BlockRequest,
    BlockResponse,
    CandidatePreview,
    CloseMatchRequest,
    CloseMatchResponse,
    CompatibilityExplanationResponse,
    CompatibilityMode,
    ConversationMessagesResponse,
    ConversationPeer,
    ConversationResponse,
    ConversationSafetyActions,
    ConversationStatus,
    FeedCard,
    FeedCardActions,
    FeedCandidateContext,
    FeedDecisionMode,
    FeedEmptyStateCode,
    FeedReactionAction,
    FeedReactionRequest,
    FeedReactionResponse,
    FeedReactionResult,
    FeedResponse,
    FutureFeedStatus,
    MatchLink,
    MatchListItem,
    MatchListResponse,
    MatchStatus,
    MessageDeliveryStatus,
    MessageResponse,
    MockExplanationRequest,
    MockRecommendationRequest,
    OnboardingFinishResponse,
    OnboardingStateResponse,
    OnboardingStatus,
    PairStateStatus,
    ReportRequest,
    ReportResponse,
    SendMessageRequest,
)
from service.users.exceptions import UserNotFoundError

from .exceptions import (
    AlreadyBlockedError,
    ConversationNotFoundError,
    ConversationUnavailableError,
    FeedItemAlreadyProcessedError,
    FeedItemNotFoundError,
    FeedLockedError,
    InvalidMatchStateError,
    InvalidSafetyTargetError,
    MatchNotFoundError,
    MessageValidationError,
    OnboardingNotReadyError,
)
from .ml_facade import MlFacade, MockMlFacade, _age_for_birth_date


def normalize_pair(user_a_id, user_b_id):
    return tuple(sorted((user_a_id, user_b_id)))


class BaseDatingService:
    def __init__(
        self,
        *,
        uow: UoW,
        user_repo: UserInterface,
        dating_repo: DatingInterface,
        ml_facade: MlFacade,
        settings: Settings | None = None,
    ):
        self.uow = uow
        self.user_repo = user_repo
        self.dating_repo = dating_repo
        self.ml_facade = ml_facade
        self.settings = settings or get_settings()
        self._tz = ZoneInfo(getattr(self.settings, "APP_TIMEZONE", "Europe/Moscow"))
        self.daily_limit = getattr(self.settings, "FEED_DAILY_LIMIT", 12)
        self.cooldown_days = getattr(self.settings, "PAIR_COOLDOWN_DAYS", 30)

    def local_today(self) -> date:
        return datetime.now(self._tz).date()

    def local_end_of_day(self) -> datetime:
        tomorrow = self.local_today() + timedelta(days=1)
        end_local = datetime.combine(tomorrow, datetime.min.time(), tzinfo=self._tz)
        return end_local.astimezone(UTC)

    def now(self) -> datetime:
        return datetime.now(UTC)

    def ensure_feed_ready(self, user: User) -> None:
        if user.onboarding_status != OnboardingStatus.READY_FOR_FEED.value:
            raise FeedLockedError(detail=f"Feed is unavailable: {user.onboarding_status}")

    def build_feed_context(self, user: User) -> FeedCandidateContext:
        if not user.birth_date or not user.city or not user.avatar_url:
            raise FeedLockedError("User profile is incomplete for feed generation")
        return FeedCandidateContext(
            user_id=user.id,
            display_name=user.resolved_display_name or user.email.split("@")[0],
            birth_date=user.birth_date,
            city_id=user.city.id,
            city_name=user.city.name,
            bio=user.bio,
            gender=user.gender,
            looking_for_genders=list(user.looking_for_genders or []),
            age_range=AgeRange(min=user.age_range_min, max=user.age_range_max) if user.age_range_min and user.age_range_max else None,
            distance_km=user.distance_km,
            goal=user.goal,
            avatar_url=user.avatar_url,
            has_approved_photo=user.has_approved_photo,
            has_min_profile=user.has_min_profile,
        )

    async def add_audit_event(
        self,
        *,
        event_type: str,
        entity_type: AuditEntityType,
        entity_id: str,
        actor_user_id,
        payload: dict,
    ) -> AuditLog:
        return await self.dating_repo.add(
            AuditLog(
                event_type=event_type,
                entity_type=entity_type.value,
                entity_id=str(entity_id),
                actor_user_id=actor_user_id,
                payload=payload,
            )
        )

    async def add_outbox_event(self, *, topic: str, payload: dict) -> OutboxEvent:
        return await self.dating_repo.add(OutboxEvent(topic=topic, payload=payload, status="pending"))

    async def close_match_related_entities(
        self,
        *,
        match: Match | None,
        conversation: Conversation | None,
        new_status: str,
        reason: str | None = None,
    ) -> tuple[bool, bool]:
        match_closed = False
        conversation_closed = False
        now = self.now()
        if match is not None and match.status != new_status:
            match.status = new_status
            match.closed_at = now
            if reason is not None:
                match.close_reason = reason
            match_closed = True
        if conversation is not None and conversation.status != new_status:
            conversation.status = new_status
            conversation.closed_at = now
            conversation_closed = True
        return match_closed, conversation_closed


class OnboardingService(BaseDatingService):
    def get_state(self, user: User) -> OnboardingStateResponse:
        missing_fields: list[str] = []
        if not (user.display_name or user.username):
            missing_fields.append("display_name")
        if not user.birth_date:
            missing_fields.append("birth_date")
        if not user.city_id:
            missing_fields.append("city_id")
        if not user.gender:
            missing_fields.append("gender")
        if not user.looking_for_genders:
            missing_fields.append("looking_for_genders")
        if user.age_range_min is None or user.age_range_max is None:
            missing_fields.append("age_range")
        if not user.goal:
            missing_fields.append("goal")

        if user.banned:
            next_step = "profile"
        elif not user.has_min_profile:
            next_step = "profile"
        elif not user.avatar_key or not user.has_approved_photo:
            next_step = "photo"
        elif not user.is_onboarded:
            next_step = "finish"
        else:
            next_step = "feed"

        return OnboardingStateResponse(
            user_id=user.id,
            status=OnboardingStatus(user.onboarding_status),
            required_steps=["profile_basics", "preferences", "photo_upload", "finish"],
            missing_fields=missing_fields,
            has_min_profile=user.has_min_profile,
            has_approved_photo=user.has_approved_photo,
            next_step=next_step,
        )

    async def finish(self, user: User) -> OnboardingFinishResponse:
        if user.onboarding_status != OnboardingStatus.READY_FOR_FEED.value:
            raise OnboardingNotReadyError(detail=f"Onboarding is not ready: {user.onboarding_status}")
        user.is_onboarded = True
        await self.uow.commit()
        await self.uow.session.refresh(user)
        await self.add_audit_event(
            event_type="onboarding_finished",
            entity_type=AuditEntityType.USER,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={"status": user.onboarding_status},
        )
        return OnboardingFinishResponse(
            status=OnboardingStatus(user.onboarding_status),
            feed_unlocked=True,
        )


class FeedService(BaseDatingService):
    async def get_feed(self, user: User, limit: int) -> FeedResponse:
        self.ensure_feed_ready(user)
        batch = await self.dating_repo.get_active_batch_for_date(
            user_id=user.id,
            batch_date=self.local_today(),
        )
        if batch is None:
            batch = await self._create_batch(user, min(limit, self.daily_limit))

        items = await self.dating_repo.list_batch_items(batch.id)
        pending_items = [item for item in items if item.processed_at is None]
        remaining_today = len(pending_items)

        if not items:
            return FeedResponse(
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                daily_limit=batch.daily_limit,
                remaining_today=0,
                decision_mode=FeedDecisionMode(batch.decision_mode),
                cards=[],
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.NO_CANDIDATES_NOW),  # type: ignore[attr-defined]
            )

        if not pending_items:
            return FeedResponse(
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                daily_limit=batch.daily_limit,
                remaining_today=0,
                decision_mode=FeedDecisionMode(batch.decision_mode),
                cards=[],
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.DAILY_BATCH_EXHAUSTED),  # type: ignore[attr-defined]
            )

        cards = await self._build_cards(pending_items[:limit])
        return FeedResponse(
            batch_id=batch.id,
            generated_at=batch.created_at,
            expires_at=batch.expires_at,
            daily_limit=batch.daily_limit,
            remaining_today=remaining_today,
            decision_mode=FeedDecisionMode(batch.decision_mode),
            cards=cards,
            empty_state=None,
        )

    async def get_explanation(self, user: User, serve_item_id) -> CompatibilityExplanationResponse:
        item = await self.dating_repo.get_recommendation_item_for_user(
            serve_item_id=serve_item_id,
            owner_user_id=user.id,
        )
        if item is None:
            raise FeedItemNotFoundError()
        target = await self.user_repo.get_by_id(item.target_user_id)
        if target is None or target.city is None or target.birth_date is None or target.avatar_url is None:
            raise FeedItemNotFoundError()
        explanation = await self.ml_facade.explain(
            MockExplanationRequest(
                requester=self.build_feed_context(user),
                candidate=self.build_feed_context(target),
                max_reasons=min(5, max(1, len(item.reason_codes) or 3)),
            )
        )
        explanation.serve_item_id = item.id
        return explanation

    async def _create_batch(self, user: User, limit: int) -> RecommendationBatch:
        excluded_ids = await self.dating_repo.list_excluded_target_ids_for_user(user.id)
        candidates = [
            candidate
            for candidate in await self.dating_repo.list_feed_candidates(requester_id=user.id)
            if candidate.id not in excluded_ids
            and candidate.onboarding_status == OnboardingStatus.READY_FOR_FEED.value
            and candidate.is_onboarded
            and candidate.city is not None
            and candidate.birth_date is not None
            and candidate.avatar_url is not None
        ]
        scored = await self.ml_facade.rank(
            MockRecommendationRequest(
                requester=self.build_feed_context(user),
                candidates=[self.build_feed_context(candidate) for candidate in candidates],
                limit=limit,
            )
        )
        batch = await self.dating_repo.add(
            RecommendationBatch(
                user_id=user.id,
                batch_date=self.local_today(),
                expires_at=self.local_end_of_day(),
                decision_mode=scored.decision_mode.value,
                daily_limit=self.daily_limit,
            )
        )
        for rank, candidate_score in enumerate(scored.candidates, start=1):
            preview = self.ml_facade.build_preview(candidate_score)  # type: ignore[attr-defined]
            await self.dating_repo.add(
                RecommendationItem(
                    batch_id=batch.id,
                    target_user_id=candidate_score.candidate_user_id,
                    rank=rank,
                    score=candidate_score.score,
                    compatibility_mode=preview.mode.value,
                    preview=preview.preview,
                    reason_codes=[code.value for code in preview.reason_codes],
                    details_available=preview.details_available,
                )
            )
        await self.uow.commit()
        return batch

    async def _build_cards(self, items: list[RecommendationItem]) -> list[FeedCard]:
        users_by_id = {
            user.id: user
            for user in await self.user_repo.list_by_ids([item.target_user_id for item in items])
        }
        today = date.today()
        cards: list[FeedCard] = []
        for item in items:
            candidate = users_by_id.get(item.target_user_id)
            if candidate is None or candidate.city is None or candidate.birth_date is None or candidate.avatar_url is None:
                continue
            age = _age_for_birth_date(candidate.birth_date, today)
            cards.append(
                FeedCard(
                    serve_item_id=item.id,
                    candidate=CandidatePreview(
                        user_id=candidate.id,
                        display_name=candidate.resolved_display_name or candidate.email.split("@")[0],
                        age=age,
                        city_name=candidate.city.name,
                        bio=candidate.bio or "",
                        primary_photo_url=candidate.avatar_url,
                        photo_count=1,
                    ),
                    compatibility=self.ml_facade.build_preview(  # type: ignore[attr-defined]
                        type("CandidateScore", (), {
                            "score": item.score,
                            "reason_signals": [
                                type("ReasonSignal", (), {"code": code, "confidence": 0.7})
                                for code in item.reason_codes
                            ],
                        })()
                    ),
                    actions=FeedCardActions(
                        can_like=True,
                        can_pass=True,
                        can_hide=True,
                        can_block=True,
                        can_report=True,
                    ),
                )
            )
        return cards


class InteractionService(BaseDatingService):
    async def submit_reaction(
        self,
        *,
        user: User,
        serve_item_id,
        payload: FeedReactionRequest,
    ) -> FeedReactionResponse:
        item = await self.dating_repo.get_recommendation_item_for_user(
            serve_item_id=serve_item_id,
            owner_user_id=user.id,
        )
        if item is None:
            raise FeedItemNotFoundError()

        duplicate = await self.dating_repo.get_existing_interaction(
            actor_user_id=user.id,
            client_event_id=payload.client_event_id,
        )
        if duplicate is not None:
            return await self._build_existing_response(user.id, item.target_user_id, item.id, payload.action)

        if item.processed_at is not None:
            raise FeedItemAlreadyProcessedError()

        pair_state = await self.dating_repo.get_or_create_pair_state(user.id, item.target_user_id)
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
        cooldown_until = None
        if payload.action == FeedReactionAction.LIKE and counterpart_action == FeedReactionAction.LIKE.value:
            match, conversation = await self._ensure_match(user.id, item.target_user_id)
            pair_state.status = PairStateStatus.CONVERSATION_ACTIVE.value
            pair_state.match_id = match.id
            pair_state.conversation_id = conversation.id
            result = FeedReactionResult.MATCHED
            future_feed_status = FutureFeedStatus.MATCHED
            match_link = MatchLink(match_id=match.id, conversation_id=conversation.id)
        elif payload.action == FeedReactionAction.LIKE:
            pair_state.status = PairStateStatus.ONE_WAY_LIKE.value
            result = FeedReactionResult.LIKED
            future_feed_status = FutureFeedStatus.NONE
        elif payload.action == FeedReactionAction.PASS:
            cooldown_until = now + timedelta(days=self.cooldown_days)
            pair_state.status = PairStateStatus.CLOSED.value
            pair_state.cooldown_until = cooldown_until
            result = FeedReactionResult.PASSED
            future_feed_status = FutureFeedStatus.COOLDOWN
        else:
            pair_state.status = PairStateStatus.HIDDEN.value
            pair_state.hidden_by_user_id = user.id
            result = FeedReactionResult.HIDDEN
            future_feed_status = FutureFeedStatus.HIDDEN

        interaction = await self.dating_repo.add(
            InteractionEvent(
                actor_user_id=user.id,
                target_user_id=item.target_user_id,
                serve_item_id=item.id,
                action=payload.action.value,
                source_context="feed",
                client_event_id=payload.client_event_id,
            )
        )
        await self.add_audit_event(
            event_type=f"feed_{payload.action.value}",
            entity_type=AuditEntityType.FEED_ITEM,
            entity_id=str(item.id),
            actor_user_id=user.id,
            payload={"target_user_id": str(item.target_user_id), "interaction_id": str(interaction.id)},
        )
        await self.add_outbox_event(
            topic="ml.interactions.swipe",
            payload={
                "actor_user_id": str(user.id),
                "target_user_id": str(item.target_user_id),
                "action": payload.action.value,
            },
        )
        await self.uow.commit()
        return FeedReactionResponse(
            serve_item_id=item.id,
            target_user_id=item.target_user_id,
            action=payload.action,
            result=result,
            future_feed_status=future_feed_status,
            cooldown_until=cooldown_until,
            match=match_link,
        )

    async def _ensure_match(self, user_a_id, user_b_id) -> tuple[Match, Conversation]:
        existing = await self.dating_repo.get_match_for_users(user_a_id, user_b_id)
        if existing is not None:
            conversation = await self.uow.session.scalar(
                select(Conversation).where(Conversation.match_id == existing.id)
            )
            if conversation is None:
                conversation = await self.dating_repo.add(Conversation(match_id=existing.id, status=ConversationStatus.ACTIVE.value))
            existing.status = MatchStatus.ACTIVE.value
            existing.conversation_id = conversation.id
            return existing, conversation

        low_id, high_id = normalize_pair(user_a_id, user_b_id)
        match = await self.dating_repo.add(
            Match(
                user_low_id=low_id,
                user_high_id=high_id,
                status=MatchStatus.ACTIVE.value,
            )
        )
        conversation = await self.dating_repo.add(
            Conversation(match_id=match.id, status=ConversationStatus.ACTIVE.value)
        )
        match.conversation_id = conversation.id
        await self.add_audit_event(
            event_type="match_created",
            entity_type=AuditEntityType.MATCH,
            entity_id=str(match.id),
            actor_user_id=None,
            payload={"user_low_id": str(low_id), "user_high_id": str(high_id)},
        )
        await self.add_outbox_event(
            topic="ml.interactions.match-outcome",
            payload={"match_id": str(match.id), "outcome": "match_created"},
        )
        return match, conversation

    async def _build_existing_response(self, actor_user_id, target_user_id, serve_item_id, action) -> FeedReactionResponse:
        pair = await self.dating_repo.get_pair_state(actor_user_id, target_user_id)
        match_link = None
        future_feed_status = FutureFeedStatus.NONE
        result = FeedReactionResult.LIKED if action == FeedReactionAction.LIKE else FeedReactionResult.PASSED
        cooldown_until = pair.cooldown_until if pair else None
        if pair:
            if pair.status == PairStateStatus.CONVERSATION_ACTIVE.value and pair.match_id and pair.conversation_id:
                match_link = MatchLink(match_id=pair.match_id, conversation_id=pair.conversation_id)
                future_feed_status = FutureFeedStatus.MATCHED
                result = FeedReactionResult.MATCHED
            elif pair.status == PairStateStatus.CLOSED.value:
                future_feed_status = FutureFeedStatus.COOLDOWN
                result = FeedReactionResult.PASSED
            elif pair.status == PairStateStatus.HIDDEN.value:
                future_feed_status = FutureFeedStatus.HIDDEN
                result = FeedReactionResult.HIDDEN
        return FeedReactionResponse(
            serve_item_id=serve_item_id,
            target_user_id=target_user_id,
            action=action,
            result=result,
            future_feed_status=future_feed_status,
            cooldown_until=cooldown_until,
            match=match_link,
        )


class MatchService(BaseDatingService):
    async def list_matches(self, user: User) -> MatchListResponse:
        rows = await self.dating_repo.list_matches_for_user(user.id)
        items: list[MatchListItem] = []
        for match, peer, conversation, last_message in rows:
            if conversation is None or peer.avatar_url is None:
                continue
            items.append(
                MatchListItem(
                    match_id=match.id,
                    candidate_user_id=peer.id,
                    display_name=peer.resolved_display_name or peer.email.split("@")[0],
                    primary_photo_url=peer.avatar_url,
                    conversation_id=conversation.id,
                    status=MatchStatus(match.status),
                    last_message_preview=last_message.text[:120] if last_message else None,
                    last_message_at=last_message.created_at if last_message else None,
                )
            )
        return MatchListResponse(items=items)

    async def close_match(self, *, user: User, match_id, payload: CloseMatchRequest) -> CloseMatchResponse:
        match = await self.dating_repo.get_match_for_user(match_id=match_id, user_id=user.id)
        if match is None:
            raise MatchNotFoundError()
        if match.status != MatchStatus.ACTIVE.value:
            raise InvalidMatchStateError()
        conversation = None
        if match.conversation_id:
            conversation = await self.uow.session.scalar(
                select(Conversation).where(Conversation.id == match.conversation_id)
            )
        pair = await self.dating_repo.get_pair_state(match.user_low_id, match.user_high_id)
        cooldown_until = self.now() + timedelta(days=self.cooldown_days)
        match.status = MatchStatus.CLOSED.value
        match.close_reason = payload.reason_code.value
        match.closed_at = self.now()
        if pair:
            pair.status = PairStateStatus.CLOSED.value
            pair.cooldown_until = cooldown_until
        _, conversation_closed = await self.close_match_related_entities(
            match=match,
            conversation=conversation,
            new_status=ConversationStatus.CLOSED.value,
            reason=payload.reason_code.value,
        )
        await self.add_audit_event(
            event_type="match_closed",
            entity_type=AuditEntityType.MATCH,
            entity_id=str(match.id),
            actor_user_id=user.id,
            payload={"reason_code": payload.reason_code.value},
        )
        await self.add_outbox_event(
            topic="ml.interactions.match-outcome",
            payload={"match_id": str(match.id), "outcome": "conversation_closed"},
        )
        await self.uow.commit()
        return CloseMatchResponse(
            match_id=match.id,
            status=MatchStatus.CLOSED,
            conversation_closed=conversation_closed,
            future_feed_status=FutureFeedStatus.COOLDOWN,
            cooldown_until=cooldown_until,
        )


class ConversationService(BaseDatingService):
    async def get_conversation(self, *, user: User, conversation_id) -> ConversationResponse:
        row = await self.dating_repo.get_conversation_for_user(
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if row is None:
            raise ConversationNotFoundError()
        conversation, match, peer = row
        if peer.avatar_url is None:
            raise ConversationNotFoundError()
        return ConversationResponse(
            conversation_id=conversation.id,
            match_id=match.id,
            status=ConversationStatus(conversation.status),
            peer=ConversationPeer(
                user_id=peer.id,
                display_name=peer.resolved_display_name or peer.email.split("@")[0],
                primary_photo_url=peer.avatar_url,
            ),
            safety_actions=ConversationSafetyActions(can_block=True, can_report=True),
        )

    async def list_messages(self, *, user: User, conversation_id, cursor: str | None, limit: int) -> ConversationMessagesResponse:
        row = await self.dating_repo.get_conversation_for_user(
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if row is None:
            raise ConversationNotFoundError()
        cursor_dt = datetime.fromisoformat(cursor) if cursor else None
        rows = await self.dating_repo.list_messages(
            conversation_id=conversation_id,
            cursor=cursor_dt,
            limit=limit,
        )
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None
        serialized = [
            MessageResponse(
                message_id=message.id,
                client_message_id=message.client_message_id,
                sender_user_id=message.sender_user_id,
                text=message.text,
                created_at=message.created_at,
                delivery_status=MessageDeliveryStatus.SENT,
            )
            for message in reversed(items)
        ]
        return ConversationMessagesResponse(items=serialized, next_cursor=next_cursor)

    async def send_message(self, *, user: User, conversation_id, payload: SendMessageRequest) -> MessageResponse:
        row = await self.dating_repo.get_conversation_for_user(
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if row is None:
            raise ConversationNotFoundError()
        conversation, match, _ = row
        if conversation.status != ConversationStatus.ACTIVE.value or match.status != MatchStatus.ACTIVE.value:
            raise ConversationUnavailableError()
        existing = await self.dating_repo.get_existing_message(
            conversation_id=conversation_id,
            client_message_id=payload.client_message_id,
        )
        if existing is not None:
            return MessageResponse(
                message_id=existing.id,
                client_message_id=existing.client_message_id,
                sender_user_id=existing.sender_user_id,
                text=existing.text,
                created_at=existing.created_at,
                delivery_status=MessageDeliveryStatus.SENT,
            )
        if not payload.text.strip():
            raise MessageValidationError()
        message = await self.dating_repo.add(
            Message(
                conversation_id=conversation_id,
                sender_user_id=user.id,
                client_message_id=payload.client_message_id,
                text=payload.text.strip(),
            )
        )
        await self.add_audit_event(
            event_type="message_sent",
            entity_type=AuditEntityType.CONVERSATION,
            entity_id=str(conversation_id),
            actor_user_id=user.id,
            payload={"message_id": str(message.id)},
        )
        await self.add_outbox_event(
            topic="ml.interactions.match-outcome",
            payload={"match_id": str(match.id), "outcome": "first_message_sent"},
        )
        await self.uow.commit()
        return MessageResponse(
            message_id=message.id,
            client_message_id=message.client_message_id,
            sender_user_id=message.sender_user_id,
            text=message.text,
            created_at=message.created_at,
            delivery_status=MessageDeliveryStatus.SENT,
        )


class SafetyService(BaseDatingService):
    async def block(self, *, actor: User, payload: BlockRequest) -> BlockResponse:
        if actor.id == payload.target_user_id:
            raise InvalidSafetyTargetError()
        target = await self.user_repo.get_by_id(payload.target_user_id)
        if target is None:
            raise UserNotFoundError()
        existing = await self.dating_repo.get_block(actor_user_id=actor.id, target_user_id=payload.target_user_id)
        if existing is not None:
            raise AlreadyBlockedError()
        block = await self.dating_repo.add(
            Block(
                actor_user_id=actor.id,
                target_user_id=payload.target_user_id,
                source_context=payload.source_context.value,
                reason_code=payload.reason_code.value,
                client_event_id=payload.client_event_id,
            )
        )
        response = await self._apply_block_state(actor.id, payload.target_user_id, payload.reason_code.value)
        await self.add_audit_event(
            event_type="user_blocked",
            entity_type=AuditEntityType.BLOCK,
            entity_id=str(block.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(payload.target_user_id), "reason_code": payload.reason_code.value},
        )
        await self.add_outbox_event(
            topic="ml.interactions.swipe",
            payload={"actor_user_id": str(actor.id), "target_user_id": str(payload.target_user_id), "action": "block"},
        )
        await self.uow.commit()
        return response

    async def report(self, *, actor: User, payload: ReportRequest) -> ReportResponse:
        if actor.id == payload.target_user_id:
            raise InvalidSafetyTargetError()
        target = await self.user_repo.get_by_id(payload.target_user_id)
        if target is None:
            raise UserNotFoundError()
        existing = await self.dating_repo.get_existing_report(
            actor_user_id=actor.id,
            client_event_id=payload.client_event_id,
        )
        if existing is not None:
            return ReportResponse(report_id=existing.id, also_block_applied=bool(payload.also_block))
        report = await self.dating_repo.add(
            Report(
                actor_user_id=actor.id,
                target_user_id=payload.target_user_id,
                source_context=payload.source_context.value,
                category=payload.category.value,
                description=payload.description,
                related_message_id=payload.related_message_id,
                also_block=payload.also_block,
                client_event_id=payload.client_event_id,
            )
        )
        also_block_applied = False
        if payload.also_block:
            try:
                await self.block(
                    actor=actor,
                    payload=BlockRequest(
                        target_user_id=payload.target_user_id,
                        source_context=payload.source_context,
                        reason_code=BlockReasonCode.OTHER,
                        client_event_id=payload.client_event_id,
                    ),
                )
                also_block_applied = True
            except AlreadyBlockedError:
                also_block_applied = True
        await self.add_audit_event(
            event_type="user_reported",
            entity_type=AuditEntityType.REPORT,
            entity_id=str(report.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(payload.target_user_id), "category": payload.category.value},
        )
        await self.add_outbox_event(
            topic="ml.interactions.swipe",
            payload={"actor_user_id": str(actor.id), "target_user_id": str(payload.target_user_id), "action": "report"},
        )
        await self.uow.commit()
        return ReportResponse(report_id=report.id, also_block_applied=also_block_applied)

    async def _apply_block_state(self, actor_user_id, target_user_id, reason_code: str) -> BlockResponse:
        pair = await self.dating_repo.get_or_create_pair_state(actor_user_id, target_user_id)
        pair.status = PairStateStatus.BLOCKED.value
        pair.blocked_by_user_id = actor_user_id
        pair.cooldown_until = None
        match = await self.dating_repo.get_match_for_users(actor_user_id, target_user_id)
        conversation = None
        if match is not None and match.conversation_id:
            conversation = await self.uow.session.scalar(
                select(Conversation).where(Conversation.id == match.conversation_id)
            )
        match_closed, conversation_closed = await self.close_match_related_entities(
            match=match,
            conversation=conversation,
            new_status=ConversationStatus.BLOCKED.value,
            reason=reason_code,
        )
        return BlockResponse(
            target_user_id=target_user_id,
            conversation_closed=conversation_closed,
            match_closed=match_closed,
            removed_from_future_feed=True,
        )


class AuditService(BaseDatingService):
    async def list_events(self, query: AuditEventsQuery) -> AuditEventsResponse:
        events = await self.dating_repo.list_audit_events(
            entity_type=query.entity_type.value,
            entity_id=query.entity_id,
            limit=query.limit,
        )
        return AuditEventsResponse(
            items=[
                AuditEvent(
                    event_id=event.id,
                    event_type=event.event_type,
                    entity_type=event.entity_type,
                    entity_id=event.entity_id,
                    actor_user_id=event.actor_user_id,
                    created_at=event.created_at,
                    payload=event.payload,
                )
                for event in events
            ]
        )
