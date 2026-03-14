import logging
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select

from core.config import Settings, get_settings
from core.errors import BadRequestError
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
    AuditEventsQuery,
    AuditEventsResponse,
    BlockRequest,
    BlockResponse,
    CloseMatchRequest,
    CloseMatchResponse,
    CompatibilityExplanationResponse,
    ConversationMessagesResponse,
    ConversationPeer,
    ConversationResponse,
    ConversationSafetyActions,
    ConversationStatus,
    DecisionMode,
    ExplanationRequest,
    FeedAction,
    FeedCandidate,
    FeedCandidateContext,
    FeedCard,
    FeedCardActions,
    FeedEmptyStateCode,
    FeedLockReason,
    FeedReactionRequest,
    FeedReactionResponse,
    FeedReactionResult,
    FeedResponse,
    FeedState,
    IcebreakersResponse,
    MatchLink,
    MatchListItem,
    MatchListResponse,
    MatchStatus,
    MessageResponse,
    MessageStatus,
    NextAction,
    NextActionType,
    OnboardingAnswersRequest,
    OnboardingAnswersResponse,
    OnboardingConfigResponse,
    OnboardingStateResponse,
    ProfileStatus,
    QuizStatus,
    ReportRequest,
    ReportResponse,
    SafetySourceContext,
    SendMessageRequest,
)
from domain.dating.quiz_catalog import (
    get_quiz_steps,
    get_step,
)

from .exceptions import (
    AlreadyBlockedError,
    ConversationNotFoundError,
    ConversationUnavailableError,
    FeedItemNotFoundError,
    InvalidMatchStateError,
    InvalidSafetyTargetError,
    MatchNotFoundError,
)
from .ml_facade import MlFacade, _age_for_birth_date


logger = logging.getLogger(__name__)


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
        self._tz = ZoneInfo(self.settings.APP_TIMEZONE)
        self.daily_limit = self.settings.FEED_DAILY_LIMIT
        self.cooldown_days = self.settings.PAIR_COOLDOWN_DAYS

    def local_today(self) -> date:
        return datetime.now(self._tz).date()

    def local_end_of_day(self) -> datetime:
        tomorrow = self.local_today() + timedelta(days=1)
        end_local = datetime.combine(tomorrow, datetime.min.time(), tzinfo=self._tz)
        return end_local.astimezone(UTC)

    def now(self) -> datetime:
        return datetime.now(UTC)

    async def _get_answer_map(self, user_id) -> dict[str, list[str]]:
        rows = await self.dating_repo.list_quiz_answers(user_id=user_id)
        return {row.step_key: list(row.answers or []) for row in rows}

    async def _build_feed_context(self, user: User) -> FeedCandidateContext:
        return FeedCandidateContext(
            user_id=user.id,
            display_name=user.resolved_display_name or "",
            birth_date=user.birth_date,
            city=user.city.name if user.city else None,
            gender=user.gender,
            search_preferences={
                "looking_for_genders": list(user.looking_for_genders or []),
                "age_range": user.age_range,
                "distance_km": user.distance_km,
                "goal": user.goal,
            },
            bio=user.bio,
            avatar_url=user.avatar_url,
            profile_completion_percent=user.profile_completion_percent,
        )

    @staticmethod
    def _missing_profile_basics(user: User) -> list[str]:
        return [
            field
            for field in user.missing_required_fields
            if not field.startswith("search_preferences.")
        ]

    @staticmethod
    def _missing_filter_fields(user: User) -> list[str]:
        return [
            field
            for field in user.missing_required_fields
            if field.startswith("search_preferences.")
        ]

    def _build_next_action(self, user: User) -> NextAction | None:
        if user.profile_status == ProfileStatus.BLOCKED.value:
            return None
        if self._missing_profile_basics(user):
            return NextAction(
                type=NextActionType.COMPLETE_REQUIRED_FIELDS,
                title="Complete required profile fields",
                description="Add the basics needed to unlock the real feed.",
                cta_label="Complete profile",
            )
        if self._missing_filter_fields(user):
            return NextAction(
                type=NextActionType.RESUME_QUIZ if user.quiz_status == QuizStatus.IN_PROGRESS.value else NextActionType.START_QUIZ,
                title="Set your feed filters",
                description="Answer the onboarding questions that define who should appear in your feed.",
                cta_label="Continue onboarding" if user.quiz_status == QuizStatus.IN_PROGRESS.value else "Start onboarding",
            )
        if user.profile_status == ProfileStatus.AVATAR_REQUIRED.value:
            return NextAction(
                type=NextActionType.UPLOAD_AVATAR,
                title="Upload an avatar",
                description="An approved avatar is required before the feed opens.",
                cta_label="Upload avatar",
            )
        if user.profile_status == ProfileStatus.AVATAR_PENDING.value:
            return NextAction(
                type=NextActionType.WAIT_FOR_MODERATION,
                title="Wait for moderation",
                description="Your avatar is being reviewed.",
                cta_label="Okay",
            )
        if user.quiz_status == QuizStatus.IN_PROGRESS.value:
            return NextAction(
                type=NextActionType.RESUME_QUIZ,
                title="Continue onboarding",
                description="Finish the remaining feed filters to unlock matching.",
                cta_label="Resume",
            )
        if user.quiz_status in {QuizStatus.NOT_STARTED.value, QuizStatus.SKIPPED.value}:
            return NextAction(
                type=NextActionType.START_QUIZ,
                title="Set feed filters",
                description="Answer the onboarding questions that decide who appears in your feed.",
                cta_label="Start onboarding",
            )
        return NextAction(
            type=NextActionType.OPEN_FEED,
            title="Open feed",
            description="Your profile is ready for browsing.",
            cta_label="Open feed",
        )

    def _build_lock_reason(self, user: User) -> FeedLockReason | None:
        if user.profile_status == ProfileStatus.BLOCKED.value:
            return FeedLockReason.BLOCKED
        if user.profile_status in {
            ProfileStatus.DRAFT.value,
            ProfileStatus.REQUIRED_FIELDS_MISSING.value,
        }:
            return FeedLockReason.REQUIRED_FIELDS_MISSING
        if user.profile_status == ProfileStatus.AVATAR_PENDING.value:
            return FeedLockReason.AVATAR_PENDING
        if user.profile_status == ProfileStatus.AVATAR_REQUIRED.value:
            return FeedLockReason.AVATAR_REQUIRED
        return None

    async def _build_onboarding_state(self, user: User) -> OnboardingStateResponse:
        answers = await self._get_answer_map(user.id)
        completed_steps = [step.step_key for step in get_quiz_steps() if step.step_key in answers]
        current_step = next((step.step_key for step in get_quiz_steps() if step.step_key not in answers), None)
        return OnboardingStateResponse(
            quiz_status=user.quiz_status,
            profile_status=user.profile_status,
            feed_unlocked=user.can_open_feed,
            current_step_key=user.quiz_current_step_key or current_step,
            completed_steps=completed_steps,
            missing_required_fields=user.missing_required_fields,
            next_action=self._build_next_action(user),
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


class OnboardingService(BaseDatingService):
    async def get_state(self, user: User) -> OnboardingStateResponse:
        return await self._build_onboarding_state(user)

    def get_config(self) -> OnboardingConfigResponse:
        return OnboardingConfigResponse(steps=get_quiz_steps())

    async def save_answers(self, user: User, payload: OnboardingAnswersRequest) -> OnboardingAnswersResponse:
        step = get_step(payload.step_key)
        if step is None:
            raise BadRequestError("Unknown quiz step")

        normalized_answers = self._validate_answers(step, payload.answers)

        await self.dating_repo.upsert_quiz_answer(
            user_id=user.id,
            step_key=payload.step_key,
            answers=normalized_answers,
        )

        self._apply_quiz_answer_to_user(user, payload.step_key, normalized_answers)

        answered_steps = {
            row.step_key
            for row in await self.dating_repo.list_quiz_answers(user_id=user.id)
        }
        next_step = next((item.step_key for item in get_quiz_steps() if item.step_key not in answered_steps), None)
        completed = next_step is None

        user.quiz_status = QuizStatus.COMPLETED.value if completed else QuizStatus.IN_PROGRESS.value
        user.quiz_current_step_key = next_step
        user.is_onboarded = user.can_open_feed
        await self.add_audit_event(
            event_type="quiz_answers_saved",
            entity_type=AuditEntityType.QUIZ,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={"step_key": payload.step_key, "answers": normalized_answers, "completed": completed},
        )
        await self.uow.commit()
        await self.uow.session.refresh(user)

        return OnboardingAnswersResponse(
            quiz_status=user.quiz_status,
            next_step_key=next_step,
            completed=completed,
        )

    async def skip(self, user: User) -> OnboardingStateResponse:
        if user.quiz_status != QuizStatus.COMPLETED.value:
            user.quiz_status = QuizStatus.SKIPPED.value
            user.quiz_current_step_key = None
            user.is_onboarded = user.can_open_feed
            await self.uow.commit()
            await self.uow.session.refresh(user)
        return await self._build_onboarding_state(user)

    async def resume(self, user: User) -> OnboardingStateResponse:
        if user.quiz_status != QuizStatus.COMPLETED.value:
            answered_steps = {
                row.step_key
                for row in await self.dating_repo.list_quiz_answers(user_id=user.id)
            }
            next_step = next((item.step_key for item in get_quiz_steps() if item.step_key not in answered_steps), None)
            user.quiz_status = QuizStatus.IN_PROGRESS.value
            user.quiz_current_step_key = next_step or get_quiz_steps()[0].step_key
            await self.uow.commit()
            await self.uow.session.refresh(user)
        return await self._build_onboarding_state(user)

    def _validate_answers(self, step, answers: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(answer.strip() for answer in answers if answer and answer.strip()))

        if step.step_type.value == "range":
            if len(normalized) != 2:
                raise BadRequestError("Range step requires exactly two values")
            try:
                lower = int(normalized[0])
                upper = int(normalized[1])
            except ValueError as exc:
                raise BadRequestError("Range values must be integers") from exc
            if step.range_min is not None and lower < step.range_min:
                raise BadRequestError("Range lower bound is too small")
            if step.range_max is not None and upper > step.range_max:
                raise BadRequestError("Range upper bound is too large")
            if lower > upper:
                raise BadRequestError("Range lower bound must be less than or equal to upper bound")
            return [str(lower), str(upper)]

        if step.min_answers is not None and len(normalized) < step.min_answers:
            raise BadRequestError("Not enough answers provided for the step")
        if step.max_answers is not None and len(normalized) > step.max_answers:
            raise BadRequestError("Too many answers provided for the step")

        allowed_values = {option.value for option in step.options}
        if any(answer not in allowed_values for answer in normalized):
            raise BadRequestError("Unknown answer passed for quiz step")
        return normalized

    def _apply_quiz_answer_to_user(self, user: User, step_key: str, answers: list[str]) -> None:
        if step_key == "who_to_meet":
            user.looking_for_genders = list(answers)
            if user.distance_km is None:
                user.distance_km = 30
            return
        if step_key == "preferred_age_range":
            user.age_range_min = int(answers[0])
            user.age_range_max = int(answers[1])
            return
        if step_key == "connection_goal":
            user.goal = answers[0]
            return
        if step_key == "search_radius":
            user.distance_km = int(answers[0])
            return


class FeedService(BaseDatingService):
    async def get_feed(self, user: User, limit: int) -> FeedResponse:
        if not user.can_open_feed:
            return FeedResponse(
                feed_state=FeedState.LOCKED,
                profile_status=user.profile_status,
                quiz_status=user.quiz_status,
                decision_mode=DecisionMode.FALLBACK,
                lock_reason=self._build_lock_reason(user),
                next_action=self._build_next_action(user),
                cards=[],
            )

        try:
            batch = await self.dating_repo.get_active_batch_for_date(
                user_id=user.id,
                batch_date=self.local_today(),
            )
            if batch is None:
                batch = await self._create_batch(user, min(limit, self.daily_limit))
            items = await self.dating_repo.list_batch_items(batch.id)
        except Exception as exc:  # pragma: no cover - degraded fallback
            logger.exception("Feed generation degraded for user=%s: %s", user.id, exc)
            return FeedResponse(
                feed_state=FeedState.DEGRADED,
                profile_status=user.profile_status,
                quiz_status=user.quiz_status,
                decision_mode=DecisionMode.FALLBACK,
                cards=[],
                warnings=["feed_generation_failed"],
            )

        pending_items = [item for item in items if item.processed_at is None]
        if not items:
            return FeedResponse(
                feed_state=FeedState.EXHAUSTED,
                profile_status=user.profile_status,
                quiz_status=user.quiz_status,
                decision_mode=DecisionMode(batch.decision_mode),
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.CANDIDATE_POOL_LOW),
                cards=[],
            )

        if not pending_items:
            return FeedResponse(
                feed_state=FeedState.EXHAUSTED,
                profile_status=user.profile_status,
                quiz_status=user.quiz_status,
                decision_mode=DecisionMode(batch.decision_mode),
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.NO_MORE_CANDIDATES_TODAY),
                cards=[],
            )

        cards = await self._build_cards(pending_items[:limit])
        if not cards:
            return FeedResponse(
                feed_state=FeedState.EXHAUSTED,
                profile_status=user.profile_status,
                quiz_status=user.quiz_status,
                decision_mode=DecisionMode(batch.decision_mode),
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.SAFETY_FILTERED_ALL),
                cards=[],
            )

        return FeedResponse(
            feed_state=FeedState.READY,
            profile_status=user.profile_status,
            quiz_status=user.quiz_status,
            decision_mode=DecisionMode(batch.decision_mode),
            batch_id=batch.id,
            generated_at=batch.created_at,
            expires_at=batch.expires_at,
            cards=cards,
        )

    async def get_explanation(self, user: User, serve_item_id) -> CompatibilityExplanationResponse:
        item = await self.dating_repo.get_recommendation_item_for_user(
            serve_item_id=serve_item_id,
            owner_user_id=user.id,
        )
        if item is None:
            raise FeedItemNotFoundError()

        candidate = await self.user_repo.get_by_id(item.target_user_id)
        if candidate is None:
            raise FeedItemNotFoundError()

        return await self.ml_facade.explain(
            ExplanationRequest(
                requester=await self._build_feed_context(user),
                candidate=await self._build_feed_context(candidate),
                serve_item_id=item.id,
            )
        )

    async def _create_batch(self, user: User, limit: int) -> RecommendationBatch:
        excluded_ids = await self.dating_repo.list_excluded_target_ids_for_user(user.id)
        requester_context = await self._build_feed_context(user)
        all_candidates = [
            candidate
            for candidate in await self.dating_repo.list_feed_candidates(requester_id=user.id)
            if candidate.id not in excluded_ids
            and candidate.can_open_feed
            and self._candidate_passes_filters(
                requester_context=requester_context,
                candidate_context=await self._build_feed_context(candidate),
            )
        ]

        ranked = await self.ml_facade.rank(
            requester=requester_context,
            candidates=[await self._build_feed_context(candidate) for candidate in all_candidates],
            limit=limit,
        )

        batch = await self.dating_repo.add(
            RecommendationBatch(
                user_id=user.id,
                batch_date=self.local_today(),
                expires_at=self.local_end_of_day(),
                decision_mode=ranked.decision_mode.value,
                daily_limit=self.daily_limit,
            )
        )

        for index, candidate_score in enumerate(ranked.candidates, start=1):
            preview = self.ml_facade.build_preview(candidate_score)
            await self.dating_repo.add(
                RecommendationItem(
                    batch_id=batch.id,
                    target_user_id=candidate_score.candidate_user_id,
                    rank=index,
                    score=candidate_score.score,
                    compatibility_mode="basic_fallback",
                    preview=preview.preview,
                    reason_codes=preview.reason_codes,
                    details_available=preview.details_available,
                )
            )

        await self.uow.commit()
        return batch

    def _candidate_passes_filters(
        self,
        *,
        requester_context: FeedCandidateContext,
        candidate_context: FeedCandidateContext,
    ) -> bool:
        candidate_age = _age_for_birth_date(candidate_context.birth_date, self.local_today())
        requester_age = _age_for_birth_date(requester_context.birth_date, self.local_today())

        requester_prefs = requester_context.search_preferences
        candidate_prefs = candidate_context.search_preferences

        if requester_prefs.looking_for_genders and candidate_context.gender not in requester_prefs.looking_for_genders:
            return False
        if candidate_prefs.looking_for_genders and requester_context.gender not in candidate_prefs.looking_for_genders:
            return False

        if requester_prefs.age_range is not None:
            if candidate_age is None:
                return False
            if not (requester_prefs.age_range.min <= candidate_age <= requester_prefs.age_range.max):
                return False
        if candidate_prefs.age_range is not None and requester_age is not None:
            if not (candidate_prefs.age_range.min <= requester_age <= candidate_prefs.age_range.max):
                return False

        if requester_prefs.goal and candidate_prefs.goal and requester_prefs.goal != candidate_prefs.goal:
            return False

        # MVP location filtering is city-level because no geo coordinates are stored yet.
        if requester_prefs.distance_km is not None and requester_context.city and candidate_context.city:
            if requester_context.city != candidate_context.city:
                return False

        return True

    async def _build_cards(self, items: list[RecommendationItem]) -> list[FeedCard]:
        users_by_id = {
            item.id: item
            for item in await self.user_repo.list_by_ids([item.target_user_id for item in items])
        }
        today = date.today()
        cards: list[FeedCard] = []
        for item in items:
            candidate = users_by_id.get(item.target_user_id)
            if candidate is None:
                continue
            age = _age_for_birth_date(candidate.birth_date, today)
            badge = None
            if candidate.profile_completion_percent >= 90:
                badge = "Complete profile"
            cards.append(
                FeedCard(
                    serve_item_id=item.id,
                    candidate=FeedCandidate(
                        user_id=candidate.id,
                        display_name=candidate.resolved_display_name or "",
                        age=age,
                        city=candidate.city.name if candidate.city else None,
                        bio=candidate.bio,
                        avatar_url=candidate.avatar_url,
                        profile_completion_badge=badge,
                    ),
                    compatibility=self.ml_facade.build_preview(
                        type(
                            "PreviewCandidate",
                            (),
                            {
                                "candidate_user_id": item.target_user_id,
                                "score": item.score,
                                "reason_codes": item.reason_codes,
                            },
                        )()
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

        existing = await self.dating_repo.get_existing_interaction(
            actor_user_id=user.id,
            serve_item_id=item.id,
        )
        pair_state = await self.dating_repo.get_or_create_pair_state(user.id, item.target_user_id)
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
        result = FeedReactionResult.LIKED
        if payload.action == FeedAction.LIKE and counterpart_action == FeedAction.LIKE.value:
            match, conversation = await self._ensure_match(user.id, item.target_user_id)
            pair_state.status = "conversation_active"
            pair_state.match_id = match.id
            pair_state.conversation_id = conversation.id
            result = FeedReactionResult.MATCHED
            match_link = MatchLink(match_id=match.id, conversation_id=conversation.id)
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

        await self.dating_repo.add(
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

        return FeedReactionResponse(result=result, match=match_link, next_card_hint="next_available")

    async def _ensure_match(self, user_a_id, user_b_id) -> tuple[Match, Conversation]:
        existing = await self.dating_repo.get_match_for_users(user_a_id, user_b_id)
        if existing is not None:
            conversation = await self.uow.session.scalar(
                select(Conversation).where(Conversation.match_id == existing.id)
            )
            if conversation is None:
                conversation = await self.dating_repo.add(
                    Conversation(match_id=existing.id, status=ConversationStatus.ACTIVE.value)
                )
                existing.conversation_id = conversation.id
                await self.uow.session.flush()
            return existing, conversation

        user_low_id, user_high_id = normalize_pair(user_a_id, user_b_id)
        match = await self.dating_repo.add(
            Match(
                user_low_id=user_low_id,
                user_high_id=user_high_id,
                status=MatchStatus.ACTIVE.value,
            )
        )
        conversation = await self.dating_repo.add(
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


class MatchService(BaseDatingService):
    async def list_matches(self, user: User) -> MatchListResponse:
        rows = await self.dating_repo.list_matches_for_user(user.id)
        items = [
            MatchListItem(
                match_id=match.id,
                candidate_user_id=peer.id,
                display_name=peer.resolved_display_name or "",
                avatar_url=peer.avatar_url,
                conversation_id=conversation.id if conversation else None,
                status=match.status,
                last_message_preview=last_message.text if last_message else None,
                last_message_at=last_message.created_at if last_message else None,
                unread_count=0,
            )
            for match, peer, conversation, last_message in rows
        ]
        return MatchListResponse(items=items)

    async def close_match(
        self,
        *,
        user: User,
        match_id,
        payload: CloseMatchRequest,
    ) -> CloseMatchResponse:
        match = await self.dating_repo.get_match_for_user(match_id=match_id, user_id=user.id)
        if match is None:
            raise MatchNotFoundError()
        if match.status != MatchStatus.ACTIVE.value:
            raise InvalidMatchStateError()

        conversation = await self.uow.session.scalar(select(Conversation).where(Conversation.match_id == match.id))
        pair_state = await self.dating_repo.get_or_create_pair_state(match.user_low_id, match.user_high_id)
        now = self.now()

        match.status = MatchStatus.CLOSED.value
        match.close_reason = payload.reason_code.value
        match.closed_at = now
        if conversation is not None:
            conversation.status = ConversationStatus.CLOSED_BY_USER.value
            conversation.closed_at = now

        pair_state.status = "closed"
        pair_state.cooldown_until = now + timedelta(days=self.cooldown_days)
        await self.add_audit_event(
            event_type="match_closed",
            entity_type=AuditEntityType.MATCH,
            entity_id=str(match.id),
            actor_user_id=user.id,
            payload={"reason_code": payload.reason_code.value},
        )
        await self.uow.commit()

        return CloseMatchResponse(status="closed", removed_from_future_feed=True)


class ConversationService(BaseDatingService):
    async def get_conversation(self, *, user: User, conversation_id) -> ConversationResponse:
        row = await self.dating_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        conversation, match, peer = row
        return ConversationResponse(
            conversation_id=conversation.id,
            match_id=match.id,
            status=conversation.status,
            peer=ConversationPeer(
                user_id=peer.id,
                display_name=peer.resolved_display_name or "",
                avatar_url=peer.avatar_url,
            ),
            safety_actions=ConversationSafetyActions(can_block=True, can_report=True),
        )

    async def list_messages(
        self,
        *,
        user: User,
        conversation_id,
        cursor: str | None,
        limit: int,
    ) -> ConversationMessagesResponse:
        row = await self.dating_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        try:
            parsed_cursor = datetime.fromisoformat(cursor) if cursor else None
        except ValueError as exc:
            raise BadRequestError("Invalid cursor") from exc
        messages = await self.dating_repo.list_messages(
            conversation_id=conversation_id,
            cursor=parsed_cursor,
            limit=limit,
        )
        next_cursor = None
        if len(messages) > limit:
            next_cursor = messages[-1].created_at.isoformat()
            messages = messages[:-1]
        messages = list(reversed(messages))
        return ConversationMessagesResponse(
            items=[
                MessageResponse(
                    message_id=message.id,
                    sender_user_id=message.sender_user_id,
                    text=message.text,
                    created_at=message.created_at,
                    status=MessageStatus.SENT,
                )
                for message in messages
            ],
            next_cursor=next_cursor,
        )

    async def send_message(
        self,
        *,
        user: User,
        conversation_id,
        payload: SendMessageRequest,
    ) -> MessageResponse:
        row = await self.dating_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        conversation, match, _peer = row
        if conversation.status != ConversationStatus.ACTIVE.value:
            raise ConversationUnavailableError()

        message = await self.dating_repo.add(
            Message(
                conversation_id=conversation.id,
                sender_user_id=user.id,
                client_message_id=uuid4(),
                text=payload.text,
            )
        )
        await self.add_audit_event(
            event_type="message_sent",
            entity_type=AuditEntityType.CONVERSATION,
            entity_id=str(conversation.id),
            actor_user_id=user.id,
            payload={"match_id": str(match.id)},
        )
        await self.uow.commit()
        return MessageResponse(
            message_id=message.id,
            sender_user_id=message.sender_user_id,
            text=message.text,
            created_at=message.created_at,
            status=MessageStatus.SENT,
        )

    async def get_icebreakers(self, *, user: User, conversation_id) -> IcebreakersResponse:
        row = await self.dating_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        _conversation, _match, peer = row
        return self.ml_facade.build_icebreakers(
            requester=await self._build_feed_context(user),
            candidate=await self._build_feed_context(peer),
        )

    async def send_icebreaker(self, *, user: User, conversation_id, icebreaker_id: str) -> MessageResponse:
        icebreakers = await self.get_icebreakers(user=user, conversation_id=conversation_id)
        item = next((icebreaker for icebreaker in icebreakers.items if icebreaker.icebreaker_id == icebreaker_id), None)
        if item is None:
            raise BadRequestError("Unknown icebreaker")
        return await self.send_message(
            user=user,
            conversation_id=conversation_id,
            payload=SendMessageRequest(text=item.text),
        )


class SafetyService(BaseDatingService):
    async def block(self, *, actor: User, payload: BlockRequest) -> BlockResponse:
        target = await self.user_repo.get_by_id(payload.target_user_id)
        if target is None or target.id == actor.id:
            raise InvalidSafetyTargetError()

        existing = await self.dating_repo.get_block(actor_user_id=actor.id, target_user_id=target.id)
        if existing is not None:
            return BlockResponse(
                status="blocked",
                removed_from_future_feed=True,
                conversation_closed=False,
                match_closed=False,
            )

        block = await self.dating_repo.add(
            Block(
                actor_user_id=actor.id,
                target_user_id=target.id,
                source_context=payload.source_context.value,
                reason_code=payload.reason_code.value,
            )
        )
        pair_state = await self.dating_repo.get_or_create_pair_state(actor.id, target.id)
        pair_state.status = "blocked"
        pair_state.blocked_by_user_id = actor.id

        conversation_closed, match_closed = await self._close_related_pair_entities(pair_state, reason="blocked")
        await self.add_audit_event(
            event_type="user_blocked",
            entity_type=AuditEntityType.BLOCK,
            entity_id=str(block.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(target.id), "reason_code": payload.reason_code.value},
        )
        await self.uow.commit()

        return BlockResponse(
            status="blocked",
            removed_from_future_feed=True,
            conversation_closed=conversation_closed,
            match_closed=match_closed,
        )

    async def report(self, *, actor: User, payload: ReportRequest) -> ReportResponse:
        target = await self.user_repo.get_by_id(payload.target_user_id)
        if target is None or target.id == actor.id:
            raise InvalidSafetyTargetError()

        report = await self.dating_repo.add(
            Report(
                actor_user_id=actor.id,
                target_user_id=target.id,
                source_context=payload.source_context.value,
                category=payload.category.value,
                description=payload.description,
                related_message_id=str(payload.related_message_id) if payload.related_message_id else None,
                also_block=payload.also_block,
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
                        reason_code="other",
                    ),
                )
            except AlreadyBlockedError:
                pass
            also_block_applied = True

        await self.add_audit_event(
            event_type="user_reported",
            entity_type=AuditEntityType.REPORT,
            entity_id=str(report.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(target.id), "category": payload.category.value},
        )
        await self.uow.commit()

        return ReportResponse(
            report_id=report.id,
            status="accepted",
            also_block_applied=also_block_applied,
        )

    async def _close_related_pair_entities(self, pair_state: PairState, *, reason: str) -> tuple[bool, bool]:
        match_closed = False
        conversation_closed = False
        now = self.now()
        if pair_state.match_id:
            match = await self.uow.session.get(Match, pair_state.match_id)
            if match is not None and match.status != MatchStatus.BLOCKED.value:
                match.status = MatchStatus.BLOCKED.value
                match.close_reason = reason
                match.closed_at = now
                match_closed = True
        if pair_state.conversation_id:
            conversation = await self.uow.session.get(Conversation, pair_state.conversation_id)
            if conversation is not None and conversation.status != ConversationStatus.CLOSED_BY_BLOCK.value:
                conversation.status = ConversationStatus.CLOSED_BY_BLOCK.value
                conversation.closed_at = now
                conversation_closed = True
        return conversation_closed, match_closed


class AuditService(BaseDatingService):
    async def list_events(self, query: AuditEventsQuery) -> AuditEventsResponse:
        rows = await self.dating_repo.list_audit_events(
            entity_type=query.entity_type,
            entity_id=query.entity_id,
            limit=query.limit,
        )
        return AuditEventsResponse(
            items=[
                AuditEvent(
                    event_id=row.id,
                    event_type=row.event_type,
                    entity_type=row.entity_type,
                    entity_id=row.entity_id,
                    actor_user_id=row.actor_user_id,
                    created_at=row.created_at,
                    payload=row.payload,
                )
                for row in rows
            ]
        )
