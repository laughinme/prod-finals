import logging
from datetime import date

from database.relational_db import RecommendationBatch, RecommendationItem, User
from domain.dating import (
    AuditEntityType,
    CompatibilityExplanationResponse,
    CompatibilityPreview,
    DecisionMode,
    ExplanationRequest,
    FeedCandidate,
    FeedCard,
    FeedCardActions,
    FeedCandidateContext,
    FeedEmptyStateCode,
    FeedResponse,
    FeedState,
)

from service.matchmaking import BaseDatingService, FeedItemNotFoundError, _age_for_birth_date
from service.matchmaking.reason_signals import build_preview_reason_signals


logger = logging.getLogger(__name__)


class FeedService(BaseDatingService):
    async def get_feed(self, user: User, limit: int) -> FeedResponse:
        if not user.can_open_feed:
            return FeedResponse(
                feed_state=FeedState.LOCKED,
                profile_status=user.profile_status,
                lock_reason=self._build_lock_reason(user),
                cards=[],
            )

        try:
            batch = await self.matchmaking_repo.get_active_batch_for_date(
                user_id=user.id,
                batch_date=self.local_today(),
            )
            if batch is None:
                batch = await self._create_batch(user)
            items = await self.matchmaking_repo.list_batch_items(batch.id)
        except Exception as exc:  # pragma: no cover - degraded fallback
            logger.exception("Feed generation degraded for user=%s: %s", user.id, exc)
            return FeedResponse(
                feed_state=FeedState.DEGRADED,
                profile_status=user.profile_status,
                cards=[],
                warnings=["feed_generation_failed"],
            )

        pending_items = [item for item in items if item.processed_at is None]
        if not items:
            return FeedResponse(
                feed_state=FeedState.EXHAUSTED,
                profile_status=user.profile_status,
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
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.NO_MORE_CANDIDATES_TODAY),
                cards=[],
            )

        cards = await self._build_cards(user=user, items=pending_items[:limit])
        if not cards:
            return FeedResponse(
                feed_state=FeedState.EXHAUSTED,
                profile_status=user.profile_status,
                batch_id=batch.id,
                generated_at=batch.created_at,
                expires_at=batch.expires_at,
                empty_state=self.ml_facade.empty_state(FeedEmptyStateCode.SAFETY_FILTERED_ALL),
                cards=[],
            )

        await self.add_audit_event(
            event_type="feed_served",
            entity_type=AuditEntityType.USER,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={
                "batch_id": str(batch.id),
                "decision_mode": batch.decision_mode,
                "cards_returned": len(cards),
            },
        )
        await self.increment_funnel_counter(
            actor=user,
            counter_name="feed_served",
            decision_mode=batch.decision_mode,
        )
        await self.uow.commit()

        return FeedResponse(
            feed_state=FeedState.READY,
            profile_status=user.profile_status,
            batch_id=batch.id,
            generated_at=batch.created_at,
            expires_at=batch.expires_at,
            cards=cards,
        )

    async def get_explanation(self, user: User, serve_item_id) -> CompatibilityExplanationResponse:
        item = await self.matchmaking_repo.get_recommendation_item_for_user(
            serve_item_id=serve_item_id,
            owner_user_id=user.id,
        )
        if item is None:
            raise FeedItemNotFoundError()

        candidate = await self.user_repo.get_by_id(item.target_user_id)
        if candidate is None:
            raise FeedItemNotFoundError()
        batch = await self.matchmaking_repo.get_recommendation_batch(item.batch_id)
        decision_mode = batch.decision_mode if batch is not None else None

        await self.add_audit_event(
            event_type="feed_explanation_opened",
            entity_type=AuditEntityType.FEED_ITEM,
            entity_id=str(item.id),
            actor_user_id=user.id,
            payload={"target_user_id": str(item.target_user_id), "decision_mode": decision_mode},
        )
        await self.increment_funnel_counter(
            actor=user,
            counter_name="feed_explanation_opened",
            decision_mode=decision_mode,
        )
        await self.uow.commit()

        return await self.ml_facade.explain(
            ExplanationRequest(
                requester=await self._build_feed_context(user),
                candidate=await self._build_feed_context(candidate),
                serve_item_id=item.id,
            )
        )

    async def _create_batch(self, user: User) -> RecommendationBatch:
        excluded_ids = await self.matchmaking_repo.list_excluded_target_ids_for_user(user.id)
        requester_context = await self._build_feed_context(user)
        await self._ensure_requester_ml_profile(user=user, requester_context=requester_context)
        all_candidates = [
            candidate
            for candidate in await self.matchmaking_repo.list_feed_candidates(requester_id=user.id)
            if candidate.id not in excluded_ids
            and candidate.can_be_shown_in_feed
            and self._candidate_passes_filters(
                requester_context=requester_context,
                candidate_context=await self._build_feed_context(candidate),
            )
        ]

        ranked = await self.ml_facade.rank(
            requester=requester_context,
            candidates=[await self._build_feed_context(candidate) for candidate in all_candidates],
            limit=len(all_candidates),
        )

        batch = await self.matchmaking_repo.add(
            RecommendationBatch(
                user_id=user.id,
                batch_date=self.local_today(),
                expires_at=self.local_end_of_day(),
                decision_mode=ranked.decision_mode.value,
                daily_limit=len(ranked.candidates),
            )
        )

        for index, candidate_score in enumerate(ranked.candidates, start=1):
            preview = await self.ml_facade.build_preview(candidate_score)
            await self.matchmaking_repo.add(
                RecommendationItem(
                    batch_id=batch.id,
                    target_user_id=candidate_score.candidate_user_id,
                    rank=index,
                    score=candidate_score.score,
                    compatibility_mode=(
                        "ml_model"
                        if ranked.decision_mode == DecisionMode.MODEL
                        else "basic_fallback"
                    ),
                    preview=preview.preview,
                    reason_codes=preview.reason_codes,
                    reason_signals=[entry.model_dump() for entry in preview.reason_signals],
                    category_breakdown=[entry.model_dump() for entry in preview.category_breakdown],
                )
            )

        await self.uow.commit()
        return batch

    async def _ensure_requester_ml_profile(
        self,
        *,
        user: User,
        requester_context: FeedCandidateContext,
    ) -> None:
        if not requester_context.ml_user_id:
            return
        try:
            import_transactions_answer = await self.matchmaking_repo.get_quiz_answer(
                user_id=user.id,
                step_key="import_transactions",
            )
            import_transactions = (
                str((import_transactions_answer.answers or ["false"])[0]).strip().lower() == "true"
                if import_transactions_answer is not None
                else False
            )
            await self.ml_facade.sync_profile_preferences(
                user_id=user.id,
                ml_user_id=requester_context.ml_user_id,
                favorite_categories=list(requester_context.interests or []),
                import_transactions=import_transactions,
            )
        except Exception as exc:  # pragma: no cover - best effort sync before ranking
            logger.warning("Requester ML profile sync failed for user=%s: %s", user.id, exc)

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

        if (
            requester_prefs.looking_for_genders
            and candidate_context.gender is not None
            and candidate_context.gender not in requester_prefs.looking_for_genders
        ):
            return False
        if (
            candidate_prefs.looking_for_genders
            and requester_context.gender is not None
            and requester_context.gender not in candidate_prefs.looking_for_genders
        ):
            return False

        requester_age_range = requester_prefs.age_range
        if requester_age_range is None and requester_age is not None:
            requester_age_range = type("AgeRangeProxy", (), {
                "min": max(18, requester_age - 5),
                "max": min(99, requester_age + 5),
            })()

        if requester_age_range is not None:
            if candidate_age is not None and not (
                requester_age_range.min <= candidate_age <= requester_age_range.max
            ):
                return False
        if candidate_prefs.age_range is not None and requester_age is not None:
            if not (candidate_prefs.age_range.min <= requester_age <= candidate_prefs.age_range.max):
                return False

        return True

    async def _build_cards(self, *, user: User, items: list[RecommendationItem]) -> list[FeedCard]:
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
                    ),
                    compatibility=CompatibilityPreview(
                        score=item.score,
                        score_percent=int(round(item.score * 100)),
                        preview=item.preview,
                        reason_codes=item.reason_codes,
                        reason_signals=item.reason_signals
                        or build_preview_reason_signals(
                            reason_codes=item.reason_codes,
                            score=item.score,
                        ),
                        category_breakdown=item.category_breakdown,
                    ),
                    actions=FeedCardActions(
                        can_like=user.can_like_profiles,
                        can_pass=True,
                        can_hide=True,
                        can_block=True,
                        can_report=True,
                    ),
                )
            )
        return cards
