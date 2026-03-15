import logging
from datetime import date

from database.relational_db import RecommendationBatch, RecommendationItem, User
from domain.dating import (
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

        cards = await self._build_cards(pending_items[:limit])
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
        all_candidates = [
            candidate
            for candidate in await self.matchmaking_repo.list_feed_candidates(requester_id=user.id)
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
            preview = self.ml_facade.build_preview(candidate_score)
            await self.matchmaking_repo.add(
                RecommendationItem(
                    batch_id=batch.id,
                    target_user_id=candidate_score.candidate_user_id,
                    rank=index,
                    score=candidate_score.score,
                    compatibility_mode="basic_fallback",
                    preview=preview.preview,
                    reason_codes=preview.reason_codes,
                    category_breakdown=[entry.model_dump() for entry in preview.category_breakdown],
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

        if requester_prefs.age_range is not None:
            if candidate_age is not None and not (
                requester_prefs.age_range.min <= candidate_age <= requester_prefs.age_range.max
            ):
                return False
        if candidate_prefs.age_range is not None and requester_age is not None:
            if not (candidate_prefs.age_range.min <= requester_age <= candidate_prefs.age_range.max):
                return False

        if requester_prefs.goal and candidate_prefs.goal and requester_prefs.goal != candidate_prefs.goal:
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
                        category_breakdown=item.category_breakdown,
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
