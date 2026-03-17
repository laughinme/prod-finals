import logging
from datetime import date
from uuid import UUID

from database.relational_db import Conversation, Match, RecommendationBatch, RecommendationItem, User
from domain.dating import (
    AuditEntityType,
    CompatibilityCategoryScore,
    CompatibilityExplanationResponse,
    CompatibilityPreview,
    CompatibilityReasonCode,
    CompatibilityReasonSignal,
    DemoFeedShortcutItem,
    DemoFeedShortcutListResponse,
    DemoFeedResetResponse,
    DecisionMode,
    ExplanationRequest,
    FeedCandidate,
    FeedCard,
    FeedCardActions,
    FeedCandidateContext,
    FeedEmptyStateCode,
    FeedResponse,
    FeedState,
    RankedCandidate,
)

from service.matchmaking import BaseDatingService, FeedItemNotFoundError, _age_for_birth_date
from service.demo_accounts import DEMO_DATASET_ACCOUNTS, DEMO_FEED_PAIR_BY_EMAIL
from service.matchmaking.reason_signals import build_preview_reason_signals
from service.matchmaking.random_mix import apply_random_mix, get_random_mix_state


logger = logging.getLogger(__name__)

_FALLBACK_PREVIEW_PREFIXES = (
    "Сильное совпадение по интересам:",
    "Хорошее совпадение по интересам:",
    "Ваш общий интерес —",
)

_FALLBACK_PREVIEW_EXACT = {
    "У вас заметно совпадают интересы и привычки.",
    "У вас совместимы город и привычный ритм встреч.",
    "Ваши ожидаемые возрастные диапазоны совпадают.",
    "Вы ищете похожий формат отношений.",
    "Ваши взаимные предпочтения хорошо совпадают.",
    "Найдены признаки совместимости по интересам и поведению.",
}


def _is_template_preview(text: str) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return True
    if normalized in _FALLBACK_PREVIEW_EXACT:
        return True
    return normalized.startswith(_FALLBACK_PREVIEW_PREFIXES)


class FeedService(BaseDatingService):
    async def list_demo_shortcuts(self, user: User) -> DemoFeedShortcutListResponse:
        can_reset_pair = self._can_reset_demo_pairs(user)
        items: list[DemoFeedShortcutItem] = []
        for account in DEMO_DATASET_ACCOUNTS:
            target = await self.user_repo.get_by_demo_user_key(account.demo_user_key)
            if target is None:
                continue
            items.append(
                DemoFeedShortcutItem(
                    demo_user_key=account.demo_user_key,
                    display_name=target.resolved_display_name or account.email,
                    avatar_url=target.avatar_url,
                    bio=target.bio,
                    is_current_user=target.id == user.id,
                    can_reset_pair=can_reset_pair and target.id != user.id,
                )
            )
        return DemoFeedShortcutListResponse(items=items)

    async def get_demo_card(self, *, user: User, demo_user_key: str) -> FeedCard:
        candidate = await self.user_repo.get_by_demo_user_key(demo_user_key)
        if candidate is None or candidate.id == user.id:
            raise FeedItemNotFoundError()
        liked_you_target_ids = await self._list_liked_you_target_ids(user_id=user.id)

        batch = await self.matchmaking_repo.get_active_batch_for_date(
            user_id=user.id,
            batch_date=self.local_today(),
        )
        if batch is None:
            batch = await self.matchmaking_repo.add(
                RecommendationBatch(
                    user_id=user.id,
                    batch_date=self.local_today(),
                    expires_at=self.local_end_of_day(),
                    decision_mode=DecisionMode.MODEL.value,
                    daily_limit=0,
                )
            )

        existing_item = await self.matchmaking_repo.get_batch_item_by_target(
            batch_id=batch.id,
            target_user_id=candidate.id,
        )
        if existing_item is not None:
            cards = await self._build_cards(
                user=user,
                items=[existing_item],
                liked_you_target_ids=set(liked_you_target_ids),
            )
            if cards:
                return cards[0]
            raise FeedItemNotFoundError()

        requester_context = await self._build_feed_context(user)
        candidate_context = await self._build_feed_context(candidate)
        ranked = await self.ml_facade.rank(
            requester=requester_context,
            candidates=[candidate_context],
            limit=1,
        )
        candidate_score = ranked.candidates[0] if ranked.candidates else None
        if candidate_score is None:
            raise FeedItemNotFoundError()

        existing_items = await self.matchmaking_repo.list_batch_items(batch.id)
        preview = await self.ml_facade.build_preview(candidate_score)
        item = await self.matchmaking_repo.add(
            RecommendationItem(
                batch_id=batch.id,
                target_user_id=candidate.id,
                rank=(max((entry.rank for entry in existing_items), default=0) + 1),
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
        batch.daily_limit = max(batch.daily_limit, len(existing_items) + 1)
        await self.uow.commit()

        cards = await self._build_cards(
            user=user,
            items=[item],
            liked_you_target_ids=set(liked_you_target_ids),
        )
        if not cards:
            raise FeedItemNotFoundError()
        return cards[0]

    async def reset_demo_pair(
        self,
        *,
        user: User,
        demo_user_key: str,
    ) -> DemoFeedResetResponse:
        if not self._can_reset_demo_pairs(user):
            raise FeedItemNotFoundError()

        target = await self.user_repo.get_by_demo_user_key(demo_user_key)
        if target is None or target.id == user.id:
            raise FeedItemNotFoundError()

        for actor_id, target_id in ((user.id, target.id), (target.id, user.id)):
            block = await self.matchmaking_repo.get_block(
                actor_user_id=actor_id,
                target_user_id=target_id,
            )
            if block is not None:
                await self.matchmaking_repo.delete_block(block)

        pair_state = await self.matchmaking_repo.get_pair_state(user.id, target.id)
        if pair_state is not None:
            if pair_state.conversation_id:
                await self.notification_repo.delete_message_notifications_for_conversation(
                    conversation_id=pair_state.conversation_id,
                )
                await self.matchmaking_repo.delete_messages_for_conversation(
                    conversation_id=pair_state.conversation_id,
                )
                conversation = await self.uow.session.get(Conversation, pair_state.conversation_id)
                if conversation is not None:
                    await self.matchmaking_repo.delete_conversation(conversation)

            if pair_state.match_id:
                await self.notification_repo.delete_match_notifications_for_match(
                    match_id=pair_state.match_id,
                )
                match = await self.uow.session.get(Match, pair_state.match_id)
                if match is not None:
                    await self.matchmaking_repo.delete_match(match)

            await self.notification_repo.delete_like_notifications_for_pair_state(
                pair_state_id=pair_state.id,
            )
            await self.matchmaking_repo.reset_pair_state(pair_state)

        await self.matchmaking_repo.reset_batch_for_date(
            user_id=user.id,
            batch_date=self.local_today(),
        )
        await self.matchmaking_repo.reset_batch_for_date(
            user_id=target.id,
            batch_date=self.local_today(),
        )
        await self.add_audit_event(
            event_type="demo_pair_reset",
            entity_type=AuditEntityType.USER,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={
                "peer_user_id": str(target.id),
                "demo_user_key": demo_user_key,
            },
        )
        await self.uow.commit()
        return DemoFeedResetResponse(
            demo_user_key=demo_user_key,
            target_user_id=target.id,
        )

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
            liked_you_target_ids = await self._list_liked_you_target_ids(user_id=user.id)
            await self._sync_liked_you_candidates_into_batch(
                user=user,
                batch=batch,
                liked_you_target_ids=liked_you_target_ids,
            )
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
        pending_items = self._prioritize_liked_you_items(
            items=pending_items,
            liked_you_target_ids=liked_you_target_ids,
        )
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

        await self._refresh_template_previews(items=pending_items[:limit])

        cards = await self._build_cards(
            user=user,
            items=pending_items[:limit],
            liked_you_target_ids=set(liked_you_target_ids),
        )
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
        ranked_candidates = self._prioritize_demo_counterpart(
            requester_email=user.email,
            ranked_candidates=ranked.candidates,
            candidates=all_candidates,
        )
        random_mix_percent = get_random_mix_state().random_mix_percent
        ranked_candidates = apply_random_mix(
            ranked_candidates,
            mix_percent=random_mix_percent,
        )

        batch = await self.matchmaking_repo.add(
            RecommendationBatch(
                user_id=user.id,
                batch_date=self.local_today(),
                expires_at=self.local_end_of_day(),
                decision_mode=ranked.decision_mode.value,
                daily_limit=len(ranked_candidates),
            )
        )

        for index, candidate_score in enumerate(ranked_candidates, start=1):
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

    async def _list_liked_you_target_ids(self, *, user_id: UUID) -> list[UUID]:
        return await self.notification_repo.list_active_like_liker_user_ids(user_id=user_id, limit=100)

    async def _sync_liked_you_candidates_into_batch(
        self,
        *,
        user: User,
        batch: RecommendationBatch,
        liked_you_target_ids: list[UUID],
    ) -> None:
        if not liked_you_target_ids:
            return

        existing_items = await self.matchmaking_repo.list_batch_items(batch.id)
        existing_target_ids = {item.target_user_id for item in existing_items}
        excluded_target_ids = await self.matchmaking_repo.list_excluded_target_ids_for_user(user.id)
        missing_target_ids = [
            target_id
            for target_id in liked_you_target_ids
            if target_id not in existing_target_ids and target_id not in excluded_target_ids and target_id != user.id
        ]
        if not missing_target_ids:
            return

        users_by_id = {
            candidate.id: candidate
            for candidate in await self.user_repo.list_by_ids(missing_target_ids)
        }
        candidates = [
            users_by_id[target_id]
            for target_id in missing_target_ids
            if target_id in users_by_id and users_by_id[target_id].can_be_shown_in_feed
        ]
        if not candidates:
            return

        requester_context = await self._build_feed_context(user)
        candidate_contexts = [await self._build_feed_context(candidate) for candidate in candidates]
        ranked = await self.ml_facade.rank(
            requester=requester_context,
            candidates=candidate_contexts,
            limit=len(candidate_contexts),
        )
        ranked_by_candidate_id = {
            candidate_score.candidate_user_id: candidate_score
            for candidate_score in ranked.candidates
        }

        next_rank = max((item.rank for item in existing_items), default=0)
        for target_id in missing_target_ids:
            candidate_score = ranked_by_candidate_id.get(target_id)
            if candidate_score is None:
                continue
            preview = await self.ml_facade.build_preview(candidate_score)
            next_rank += 1
            await self.matchmaking_repo.add(
                RecommendationItem(
                    batch_id=batch.id,
                    target_user_id=target_id,
                    rank=next_rank,
                    score=candidate_score.score,
                    compatibility_mode=(
                        "ml_model"
                        if batch.decision_mode == DecisionMode.MODEL.value
                        else "basic_fallback"
                    ),
                    preview=preview.preview,
                    reason_codes=preview.reason_codes,
                    reason_signals=[entry.model_dump() for entry in preview.reason_signals],
                    category_breakdown=[entry.model_dump() for entry in preview.category_breakdown],
                )
            )

        batch.daily_limit = max(batch.daily_limit, next_rank)

    def _prioritize_liked_you_items(
        self,
        *,
        items: list[RecommendationItem],
        liked_you_target_ids: list[UUID],
    ) -> list[RecommendationItem]:
        if not items or not liked_you_target_ids:
            return items
        liked_rank_by_target_id = {
            target_id: index for index, target_id in enumerate(liked_you_target_ids)
        }
        return sorted(
            items,
            key=lambda item: (
                0 if item.target_user_id in liked_rank_by_target_id else 1,
                liked_rank_by_target_id.get(item.target_user_id, item.rank),
                item.rank,
            ),
        )

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

    def _prioritize_demo_counterpart(
        self,
        *,
        requester_email: str | None,
        ranked_candidates,
        candidates: list[User],
    ):
        normalized_email = (requester_email or "").strip().lower()
        counterpart_email = DEMO_FEED_PAIR_BY_EMAIL.get(normalized_email)
        if not counterpart_email:
            return ranked_candidates

        candidate_id_by_email = {
            (candidate.email or "").strip().lower(): candidate.id for candidate in candidates
        }
        counterpart_id = candidate_id_by_email.get(counterpart_email)
        if counterpart_id is None:
            return ranked_candidates

        prioritized = list(ranked_candidates)
        for index, candidate_score in enumerate(prioritized):
            if candidate_score.candidate_user_id == counterpart_id:
                prioritized.insert(0, prioritized.pop(index))
                return prioritized
        return prioritized

    @staticmethod
    def _can_reset_demo_pairs(user: User) -> bool:
        return bool(user.demo_user_key) or user.has_roles("admin")

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

    async def _build_cards(
        self,
        *,
        user: User,
        items: list[RecommendationItem],
        liked_you_target_ids: set[UUID] | None = None,
    ) -> list[FeedCard]:
        users_by_id = {
            item.id: item
            for item in await self.user_repo.list_by_ids([item.target_user_id for item in items])
        }
        today = date.today()
        liked_you_target_ids = liked_you_target_ids or set()
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
                    liked_you=item.target_user_id in liked_you_target_ids,
                )
            )
        return cards

    async def _refresh_template_previews(self, *, items: list[RecommendationItem]) -> None:
        for item in items:
            if not _is_template_preview(item.preview):
                continue

            try:
                reason_codes: list[CompatibilityReasonCode] = []
                for raw_code in item.reason_codes or []:
                    try:
                        reason_codes.append(CompatibilityReasonCode(str(raw_code)))
                    except ValueError:
                        continue

                reason_signals: list[CompatibilityReasonSignal] = []
                for raw_signal in item.reason_signals or []:
                    try:
                        reason_signals.append(CompatibilityReasonSignal.model_validate(raw_signal))
                    except Exception:
                        continue

                category_scores: list[CompatibilityCategoryScore] = []
                for raw_score in item.category_breakdown or []:
                    try:
                        category_scores.append(CompatibilityCategoryScore.model_validate(raw_score))
                    except Exception:
                        continue

                scored = RankedCandidate(
                    candidate_user_id=item.target_user_id,
                    score=max(0.0, min(float(item.score), 1.0)),
                    reason_codes=reason_codes,
                    reason_signals=reason_signals,
                    category_keys=[entry.category_key for entry in category_scores],
                    category_scores=category_scores,
                )
                rebuilt_preview = await self.ml_facade.build_preview(scored)
                normalized_preview = (rebuilt_preview.preview or "").strip()
                if not normalized_preview or normalized_preview == item.preview:
                    continue

                item.preview = normalized_preview
                item.reason_codes = [str(code) for code in rebuilt_preview.reason_codes]
                item.reason_signals = [entry.model_dump() for entry in rebuilt_preview.reason_signals]
                item.category_breakdown = [entry.model_dump() for entry in rebuilt_preview.category_breakdown]
            except Exception as exc:
                logger.warning("Preview refresh failed for recommendation_item=%s: %s", item.id, exc)
