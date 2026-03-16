import logging
from datetime import date
from hashlib import sha256
from uuid import NAMESPACE_DNS, UUID, uuid4, uuid5

import httpx

from domain.dating import (
    CompatibilityCategoryScore,
    CompatibilityExplanationResponse,
    CompatibilityPreview,
    CompatibilityReason,
    CompatibilityReasonCode,
    CompatibilityReasonSignal,
    DecisionMode,
    ExplanationRequest,
    FeedCandidateContext,
    FeedEmptyState,
    FeedEmptyStateCode,
    Icebreaker,
    IcebreakersResponse,
    RankedCandidate,
    RankedCandidates,
)
from domain.misc import MlConnectionStatusModel
from domain.dating.category_catalog import category_label_map, pick_category_keys
from .reason_signals import build_preview_reason_signals


def _age_for_birth_date(birth_date: date | None, today: date) -> int | None:
    if birth_date is None:
        return None
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


def _normalize_ml_id(raw: object) -> str:
    return str(raw).strip().lower()


def _deterministic_qdrant_uuid(raw: str) -> str:
    return str(uuid5(NAMESPACE_DNS, raw))


def _is_healthy_ml_check(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"ok", "true", "healthy", "ready"}
    return bool(value)


def _is_specific_category_label(value: str | None) -> bool:
    if not value:
        return False
    normalized = value.strip().lower()
    return normalized not in {
        "",
        "unknown",
        "unknown_category",
        "none",
        "n/a",
        "другое",
    }


def _top_category_label(scores: list[CompatibilityCategoryScore]) -> str | None:
    for item in scores:
        if _is_specific_category_label(item.label):
            return item.label
    return None


def _top_category_key(scores: list[CompatibilityCategoryScore]) -> str | None:
    for item in scores:
        if _is_specific_category_label(item.label):
            return (item.category_key or item.label).strip().lower()
    return None


def _diversify_by_top_category(scored: list[RankedCandidate]) -> list[RankedCandidate]:
    if len(scored) < 3:
        return scored

    remaining = list(scored)
    diversified: list[RankedCandidate] = []
    previous_key: str | None = None

    while remaining:
        chosen_index = 0
        for index, candidate in enumerate(remaining):
            key = _top_category_key(candidate.category_scores)
            if previous_key is None or key is None or key != previous_key:
                chosen_index = index
                break

        selected = remaining.pop(chosen_index)
        diversified.append(selected)
        previous_key = _top_category_key(selected.category_scores)

    return diversified


class MlFacade:
    async def rank(
        self,
        requester: FeedCandidateContext,
        candidates: list[FeedCandidateContext],
        limit: int,
    ) -> RankedCandidates:
        raise NotImplementedError

    async def explain(self, payload: ExplanationRequest) -> CompatibilityExplanationResponse:
        raise NotImplementedError

    def build_preview(self, scored: RankedCandidate) -> CompatibilityPreview:
        raise NotImplementedError

    def empty_state(self, code: FeedEmptyStateCode) -> FeedEmptyState:
        raise NotImplementedError

    def build_icebreakers(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> IcebreakersResponse:
        raise NotImplementedError

    async def sync_onboarding_profile(
        self,
        *,
        user_id: UUID,
        ml_user_id: str | None,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        raise NotImplementedError

    async def sync_profile_preferences(
        self,
        *,
        user_id: UUID,
        ml_user_id: str | None,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        raise NotImplementedError

    async def connection_status(self) -> MlConnectionStatusModel:
        raise NotImplementedError


class MockMlFacade(MlFacade):
    async def rank(
        self,
        requester: FeedCandidateContext,
        candidates: list[FeedCandidateContext],
        limit: int,
    ) -> RankedCandidates:
        today = date.today()
        scored: list[RankedCandidate] = []
        for candidate in candidates:
            score = 0.08
            reason_codes: list[CompatibilityReasonCode] = []

            if self._has_mutual_gender_fit(requester, candidate):
                score += 0.22
                reason_codes.append(CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT)

            overlap_keys = self._interest_overlap(requester, candidate)
            if overlap_keys:
                score += min(0.20, 0.05 * len(overlap_keys))
                reason_codes.append(CompatibilityReasonCode.CATEGORY_FIT)

            if (
                requester.search_preferences.goal
                and candidate.search_preferences.goal
                and requester.search_preferences.goal == candidate.search_preferences.goal
            ):
                score += 0.16
                reason_codes.append(CompatibilityReasonCode.GOAL_FIT)

            requester_age = _age_for_birth_date(requester.birth_date, today)
            candidate_age = _age_for_birth_date(candidate.birth_date, today)
            if self._has_mutual_age_fit(requester, candidate, requester_age, candidate_age):
                score += 0.16
                reason_codes.append(CompatibilityReasonCode.AGE_FIT)

            completion_bonus = min(candidate.profile_completion_percent / 1000, 0.10)
            if completion_bonus:
                score += completion_bonus
                reason_codes.append(CompatibilityReasonCode.PROFILE_QUALITY)

            score = round(min(score, 0.99), 2)
            category_keys = self._resolve_category_keys(requester, candidate)
            normalized_reason_codes = reason_codes[:4] or [CompatibilityReasonCode.PROFILE_QUALITY]
            reason_signal_payloads = build_preview_reason_signals(
                reason_codes=[code.value for code in normalized_reason_codes],
                score=score,
            )
            category_scores = self._build_category_breakdown(
                category_keys=category_keys,
                candidate_seed=candidate.ml_user_id or str(candidate.user_id),
                score_percent=int(round(score * 100)),
            )

            scored.append(
                RankedCandidate(
                    candidate_user_id=candidate.user_id,
                    score=score,
                    reason_codes=normalized_reason_codes,
                    reason_signals=reason_signal_payloads,
                    category_keys=category_keys,
                    category_scores=category_scores,
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        scored = _diversify_by_top_category(scored)
        return RankedCandidates(
            decision_mode=DecisionMode.FALLBACK,
            candidates=scored[:limit],
        )

    async def explain(self, payload: ExplanationRequest) -> CompatibilityExplanationResponse:
        ranked = await self.rank(payload.requester, [payload.candidate], limit=1)
        scored = ranked.candidates[0]
        reasons = [
            self._reason_from_code(code)
            for code in scored.reason_codes[:3]
        ]
        return CompatibilityExplanationResponse(
            serve_item_id=payload.serve_item_id,
            candidate_user_id=payload.candidate.user_id,
            reasons=reasons,
            disclaimer="These explanations use aggregated profile and onboarding filter signals only.",
        )

    def build_preview(self, scored: RankedCandidate) -> CompatibilityPreview:
        reason_codes = [
            code if isinstance(code, CompatibilityReasonCode) else CompatibilityReasonCode(code)
            for code in scored.reason_codes
        ]
        primary = reason_codes[0]
        top_category_label = _top_category_label(scored.category_scores)
        if CompatibilityReasonCode.CATEGORY_FIT in reason_codes and top_category_label:
            preview = f"Вы оба любите «{top_category_label}»."
        else:
            preview_map = {
                CompatibilityReasonCode.CATEGORY_FIT: "У вас заметно совпадают интересы и привычки.",
                CompatibilityReasonCode.CITY_FIT: "У вас совместимы город и привычный ритм встреч.",
                CompatibilityReasonCode.AGE_FIT: "Ваши ожидаемые возрастные диапазоны совпадают.",
                CompatibilityReasonCode.GOAL_FIT: "Вы ищете похожий формат отношений.",
                CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT: "Ваши взаимные предпочтения хорошо совпадают.",
                CompatibilityReasonCode.PROFILE_QUALITY: "Профиль даёт достаточно данных для уверенной рекомендации.",
            }
            preview = preview_map[primary]
        score_percent = int(round(scored.score * 100))
        return CompatibilityPreview(
            score=scored.score,
            score_percent=score_percent,
            preview=preview,
            reason_codes=[code.value for code in reason_codes],
            reason_signals=scored.reason_signals
            or build_preview_reason_signals(
                reason_codes=[code.value for code in reason_codes],
                score=scored.score,
            ),
            category_breakdown=scored.category_scores
            or self._build_category_breakdown(
                category_keys=scored.category_keys,
                candidate_seed=str(scored.candidate_user_id),
                score_percent=score_percent,
            ),
        )

    def empty_state(self, code: FeedEmptyStateCode) -> FeedEmptyState:
        mapping = {
            FeedEmptyStateCode.NO_MORE_CANDIDATES_TODAY: (
                "No more candidates today",
                "You have seen today's ready cards. Try again later.",
            ),
            FeedEmptyStateCode.CANDIDATE_POOL_LOW: (
                "Candidate pool is low",
                "We need a bit more signal or more ready profiles to build a stronger batch.",
            ),
            FeedEmptyStateCode.SAFETY_FILTERED_ALL: (
                "Nothing new after safety filters",
                "Current candidates were filtered out by your previous actions or safety rules.",
            ),
            FeedEmptyStateCode.TRY_AGAIN_TOMORROW: (
                "Try again tomorrow",
                "A fresh batch will be prepared later.",
            ),
        }
        title, description = mapping[code]
        return FeedEmptyState(code=code, title=title, description=description)

    def build_icebreakers(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> IcebreakersResponse:
        return IcebreakersResponse(
            items=[
                Icebreaker(
                    icebreaker_id="city_opening",
                    text="What place in your city would you happily revisit together?",
                    reason="A safe opener based on local context.",
                ),
                Icebreaker(
                    icebreaker_id="weekend_opening",
                    text="What does a great weekend usually look like for you?",
                    reason="Works well as a low-pressure first question.",
                ),
                Icebreaker(
                    icebreaker_id="goal_opening",
                    text="What are you hoping to find here right now?",
                    reason="Useful when both sides want to align expectations early.",
                ),
            ]
        )

    async def sync_onboarding_profile(
        self,
        *,
        user_id: UUID,
        ml_user_id: str | None,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        return None

    async def sync_profile_preferences(
        self,
        *,
        user_id: UUID,
        ml_user_id: str | None,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        return None

    async def connection_status(self) -> MlConnectionStatusModel:
        return MlConnectionStatusModel(
            configured=False,
            provider="mock",
            reachable=False,
            healthy=False,
            fallback_active=True,
            ml_status=None,
            detail="ML_SERVICE_URL is not configured; backend is using MockMlFacade.",
        )

    def _has_mutual_gender_fit(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> bool:
        return bool(
            requester.gender
            and candidate.gender
            and candidate.gender in (requester.search_preferences.looking_for_genders or [])
            and requester.gender in (candidate.search_preferences.looking_for_genders or [])
        )

    def _has_mutual_age_fit(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
        requester_age: int | None,
        candidate_age: int | None,
    ) -> bool:
        if requester_age is None or candidate_age is None:
            return False
        requester_range = requester.search_preferences.age_range
        candidate_range = candidate.search_preferences.age_range
        if requester_range is None or candidate_range is None:
            return False
        return (
            requester_range.min <= candidate_age <= requester_range.max
            and candidate_range.min <= requester_age <= candidate_range.max
        )

    def _reason_from_code(self, code: CompatibilityReasonCode) -> CompatibilityReason:
        mapping = {
            CompatibilityReasonCode.CITY_FIT: (
                "Similar city rhythm",
                "You appear to be in a compatible local context for actually meeting offline.",
                0.78,
            ),
            CompatibilityReasonCode.CATEGORY_FIT: (
                "Common interests and habits",
                "Your selected preference categories suggest a stronger everyday compatibility.",
                0.79,
            ),
            CompatibilityReasonCode.AGE_FIT: (
                "Mutual age fit",
                "Both profiles fall within each other's preferred age range.",
                0.76,
            ),
            CompatibilityReasonCode.GOAL_FIT: (
                "Aligned intentions",
                "You are looking for a similar type of connection right now.",
                0.74,
            ),
            CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT: (
                "Preferences align both ways",
                "Your mutual preferences suggest the match is viable from both sides.",
                0.81,
            ),
            CompatibilityReasonCode.PROFILE_QUALITY: (
                "Strong profile signal",
                "The profile contains enough detail to support a more stable recommendation.",
                0.63,
            ),
        }
        title, text, confidence = mapping[code]
        return CompatibilityReason(code=code.value, title=title, text=text, confidence=confidence)

    def _interest_overlap(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> list[str]:
        requester_interests = set(requester.interests or [])
        candidate_interests = list(dict.fromkeys(candidate.interests or []))
        if not requester_interests or not candidate_interests:
            return []
        return [key for key in candidate_interests if key in requester_interests]

    def _resolve_category_keys(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> list[str]:
        overlap = self._interest_overlap(requester, candidate)
        if overlap:
            return overlap[:5]
        if candidate.interests:
            return list(dict.fromkeys(candidate.interests))[:5]
        if requester.interests:
            return list(dict.fromkeys(requester.interests))[:5]
        seed_key = candidate.ml_user_id or str(candidate.user_id)
        return pick_category_keys(f"compatibility:{seed_key}")

    def _build_category_breakdown(
        self,
        *,
        category_keys: list[str],
        candidate_seed: str,
        score_percent: int,
    ) -> list[CompatibilityCategoryScore]:
        labels = category_label_map()
        category_keys = list(dict.fromkeys(category_keys or []))
        if not category_keys:
            category_keys = pick_category_keys(f"compatibility:{candidate_seed}")

        items: list[CompatibilityCategoryScore] = []
        for key in category_keys[:5]:
            digest = sha256(f"{candidate_seed}:{key}".encode("utf-8")).digest()
            item_score = max(35, min(99, score_percent - 12 + (digest[0] % 25)))
            items.append(
                CompatibilityCategoryScore(
                    category_key=key,
                    label=labels.get(key, key),
                    score_percent=item_score,
                )
            )
        return items
logger = logging.getLogger(__name__)

# ML ReasonCode → backend CompatibilityReasonCode
_ML_REASON_MAP: dict[str, CompatibilityReasonCode] = {
    "lifestyle_similarity": CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT,
    "activity_overlap": CompatibilityReasonCode.CATEGORY_FIT,
    "communication_style_fit": CompatibilityReasonCode.CITY_FIT,
    "meetup_rhythm_fit": CompatibilityReasonCode.AGE_FIT,
    "locality_fit": CompatibilityReasonCode.CITY_FIT,
    "novelty_boost": CompatibilityReasonCode.PROFILE_QUALITY,
}


class HttpMlFacade(MlFacade):
    """MlFacade implementation that calls the real ML service over HTTP."""

    def __init__(self, *, base_url: str, service_token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._service_token = service_token
        self._fallback = MockMlFacade()

    def _headers(self) -> dict[str, str]:
        return {"X-Service-Token": self._service_token}

    def _map_reason_code(self, ml_code: str) -> CompatibilityReasonCode:
        return _ML_REASON_MAP.get(ml_code, CompatibilityReasonCode.PROFILE_QUALITY)

    def _map_reason_signal(
        self,
        payload: dict,
        *,
        top_category_label: str | None = None,
    ) -> CompatibilityReasonSignal:
        code = str(payload.get("code", "")).strip() or CompatibilityReasonCode.PROFILE_QUALITY.value
        return CompatibilityReasonSignal(
            code=code,
            label=self._signal_label(code, top_category_label=top_category_label),
            strength=str(payload.get("strength", "medium")).strip() or "medium",
            confidence=float(payload.get("confidence", 0.5) or 0.5),
        )

    def _signal_label(
        self,
        code: str,
        *,
        top_category_label: str | None = None,
    ) -> str:
        if code == "activity_overlap" and _is_specific_category_label(top_category_label):
            return f"Вы оба любите «{top_category_label}»"
        mapping = {
            "lifestyle_similarity": "Похожий образ жизни",
            "activity_overlap": "Похожие интересы",
            "communication_style_fit": "Подходит стиль общения",
            "meetup_rhythm_fit": "Совпадает ритм встреч",
            "locality_fit": "Комфортная география встречи",
            "novelty_boost": "Новый релевантный кандидат",
        }
        return mapping.get(code, "Сигнал совместимости")

    def _preview_text(
        self,
        reason_codes: list[CompatibilityReasonCode],
        *,
        category_scores: list[CompatibilityCategoryScore] | None = None,
    ) -> str:
        primary = reason_codes[0] if reason_codes else CompatibilityReasonCode.PROFILE_QUALITY
        top_category_label = _top_category_label(category_scores or [])
        if CompatibilityReasonCode.CATEGORY_FIT in reason_codes and top_category_label:
            return f"Вы оба любите «{top_category_label}»."
        preview_map = {
            CompatibilityReasonCode.CATEGORY_FIT: "У вас заметно совпадают интересы и привычки.",
            CompatibilityReasonCode.CITY_FIT: "У вас совместимы город и привычный ритм встреч.",
            CompatibilityReasonCode.AGE_FIT: "Ваши ожидаемые возрастные диапазоны совпадают.",
            CompatibilityReasonCode.GOAL_FIT: "Вы ищете похожий формат отношений.",
            CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT: "Ваши взаимные предпочтения хорошо совпадают.",
            CompatibilityReasonCode.PROFILE_QUALITY: "Профиль даёт достаточно данных для уверенной рекомендации.",
        }
        return preview_map[primary]

    def _map_decision_mode(self, ml_mode: str) -> DecisionMode:
        if ml_mode == "model":
            return DecisionMode.MODEL
        return DecisionMode.FALLBACK

    async def rank(
        self,
        requester: FeedCandidateContext,
        candidates: list[FeedCandidateContext],
        limit: int,
    ) -> RankedCandidates:
        trace_id = uuid4()
        request_ml_id = requester.ml_user_id or str(requester.user_id)
        request_ml_id_norm = _normalize_ml_id(request_ml_id)
        query_limit = min(max(limit, 1), 2000)

        candidate_id_map: dict[str, UUID] = {}
        for candidate in candidates:
            candidate_uuid = candidate.user_id
            candidate_id_map[_normalize_ml_id(str(candidate_uuid))] = candidate_uuid
            candidate_id_map[_deterministic_qdrant_uuid(_normalize_ml_id(str(candidate_uuid)))] = candidate_uuid
            if candidate.ml_user_id:
                ml_key = _normalize_ml_id(candidate.ml_user_id)
                candidate_id_map[ml_key] = candidate_uuid
                candidate_id_map[_deterministic_qdrant_uuid(ml_key)] = candidate_uuid

        payload = {
            "trace_id": str(trace_id),
            "request_user_id": request_ml_id_norm,
            "limit": query_limit,
            "strategy": "balanced",
            "candidate_user_ids": [
                _normalize_ml_id(candidate.ml_user_id or str(candidate.user_id))
                for candidate in candidates
            ],
            "exclusion": {"hard_exclude_user_ids": [request_ml_id_norm]},
            "context": {
                "request_ts": date.today().isoformat() + "T00:00:00Z",
                "client": "web",
                "decision_policy": "daily_batch",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/recommendations",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("ML service /v1/recommendations failed: %s, falling back to mock", exc)
            return await self._fallback.rank(requester, candidates, limit)

        ml_candidates = data.get("candidates", [])
        decision_mode = self._map_decision_mode(data.get("decision_mode", "fallback"))

        scored: list[RankedCandidate] = []
        for ml_item in ml_candidates:
            candidate_user_id_raw = _normalize_ml_id(ml_item.get("candidate_user_id", ""))
            candidate_uuid = candidate_id_map.get(candidate_user_id_raw)
            if candidate_uuid is None:
                continue

            category_scores = self._category_scores_from_components(ml_item)
            top_category_label = _top_category_label(category_scores)
            reason_codes = []
            for signal in ml_item.get("reason_signals", []):
                code = self._map_reason_code(signal.get("code", ""))
                if code not in reason_codes:
                    reason_codes.append(code)

            if not reason_codes:
                reason_codes.append(CompatibilityReasonCode.PROFILE_QUALITY)

            scored.append(
                RankedCandidate(
                    candidate_user_id=candidate_uuid,
                    score=round(min(max(ml_item.get("score", 0.0), 0.0), 0.99), 2),
                    reason_codes=reason_codes[:4],
                    reason_signals=[
                        self._map_reason_signal(
                            signal,
                            top_category_label=top_category_label,
                        )
                        for signal in ml_item.get("reason_signals", [])
                    ],
                    category_keys=[],
                    category_scores=category_scores,
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        scored = _diversify_by_top_category(scored)

        if not scored:
            logger.info("ML returned %d candidates but none matched backend user pool, falling back to mock", len(ml_candidates))
            return await self._fallback.rank(requester, candidates, limit)

        return RankedCandidates(
            decision_mode=decision_mode,
            candidates=scored[:limit],
        )

    async def explain(self, payload: ExplanationRequest) -> CompatibilityExplanationResponse:
        trace_id = uuid4()
        requester_ml_id = payload.requester.ml_user_id or str(payload.requester.user_id)
        candidate_ml_id = payload.candidate.ml_user_id or str(payload.candidate.user_id)
        ml_payload = {
            "trace_id": str(trace_id),
            "requester_user_id": _normalize_ml_id(requester_ml_id),
            "candidate_user_id": _normalize_ml_id(candidate_ml_id),
            "channel": "feed",
            "locale": "ru-RU",
            "max_reasons": 3,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/explanations/compatibility",
                    json=ml_payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("ML service /v1/explanations/compatibility failed: %s, falling back to mock", exc)
            return await self._fallback.explain(payload)

        reasons: list[CompatibilityReason] = []
        for r in data.get("reasons", []):
            code = self._map_reason_code(r.get("code", ""))
            reasons.append(
                CompatibilityReason(
                    code=code.value,
                    title=r.get("template_key", code.value),
                    text=r.get("template_key", ""),
                    confidence=r.get("confidence", 0.5),
                )
            )

        if not reasons:
            reasons.append(
                CompatibilityReason(
                    code=CompatibilityReasonCode.PROFILE_QUALITY.value,
                    title="Strong profile signal",
                    text="The profile contains enough detail to support a more stable recommendation.",
                    confidence=0.63,
                )
            )

        return CompatibilityExplanationResponse(
            serve_item_id=payload.serve_item_id,
            candidate_user_id=payload.candidate.user_id,
            reasons=reasons,
            disclaimer="These explanations use aggregated profile and ML signals.",
        )

    def build_preview(self, scored: RankedCandidate) -> CompatibilityPreview:
        reason_codes = [
            code if isinstance(code, CompatibilityReasonCode) else CompatibilityReasonCode(code)
            for code in scored.reason_codes
        ]
        score_percent = int(round(scored.score * 100))
        return CompatibilityPreview(
            score=scored.score,
            score_percent=score_percent,
            preview=self._preview_text(
                reason_codes,
                category_scores=scored.category_scores,
            ),
            reason_codes=[code.value for code in reason_codes],
            reason_signals=scored.reason_signals
            or build_preview_reason_signals(
                reason_codes=[code.value for code in reason_codes],
                score=scored.score,
            ),
            category_breakdown=scored.category_scores,
        )

    def empty_state(self, code: FeedEmptyStateCode) -> FeedEmptyState:
        return self._fallback.empty_state(code)

    def build_icebreakers(
        self,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> IcebreakersResponse:
        return self._fallback.build_icebreakers(requester, candidate)

    async def sync_onboarding_profile(
        self,
        *,
        user_id: UUID,
        ml_user_id: str | None,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        categories = list(dict.fromkeys(favorite_categories))
        if not categories:
            categories = pick_category_keys(f"onboarding:{user_id}")[:3]

        payload = {
            "trace_id": str(uuid4()),
            "user_id": _normalize_ml_id(ml_user_id or str(user_id)),
            "favorite_categories": categories[:15],
            "import_transactions": import_transactions,
            "preferred_activity_hour": None,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/profiles/onboarding",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
        except Exception as exc:
            logger.warning("ML service /v1/profiles/onboarding failed: %s", exc)

    async def sync_profile_preferences(
        self,
        *,
        user_id: UUID,
        ml_user_id: str | None,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        categories = list(dict.fromkeys(favorite_categories))
        if not categories:
            categories = pick_category_keys(f"profile:{user_id}")[:3]
        payload = {
            "trace_id": str(uuid4()),
            "user_id": _normalize_ml_id(ml_user_id or str(user_id)),
            "favorite_categories": categories[:15],
            "import_transactions": import_transactions,
            "preferred_activity_hour": None,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/profile/preferences",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
        except Exception as exc:
            logger.warning("ML service /v1/profile/preferences failed: %s", exc)

    async def connection_status(self) -> MlConnectionStatusModel:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/health",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            return MlConnectionStatusModel(
                configured=True,
                provider="http",
                base_url=self._base_url,
                reachable=False,
                healthy=False,
                fallback_active=True,
                ml_status=None,
                detail=str(exc),
            )

        ml_status = str(data.get("status") or "").strip() or None
        healthy = ml_status not in {"", "down"}
        detail = None
        checks = data.get("checks")
        if isinstance(checks, dict):
            failed = [name for name, value in checks.items() if not _is_healthy_ml_check(value)]
            if failed:
                detail = f"Degraded ML checks: {', '.join(failed)}"

        return MlConnectionStatusModel(
            configured=True,
            provider="http",
            base_url=self._base_url,
            reachable=True,
            healthy=healthy,
            fallback_active=not healthy,
            ml_status=ml_status,
            detail=detail,
        )

    def _category_scores_from_components(self, ml_item: dict) -> list[CompatibilityCategoryScore]:
        components = ml_item.get("score_components") or {}
        if not isinstance(components, dict):
            return []

        labels = category_label_map()
        normalized_items = [
            (str(key), float(value))
            for key, value in components.items()
            if str(key).strip() and isinstance(value, (int, float))
        ]
        if not normalized_items:
            return []

        total = sum(max(value, 0.0) for _, value in normalized_items) or 1.0
        ranked = sorted(normalized_items, key=lambda item: item[1], reverse=True)[:5]
        return [
            CompatibilityCategoryScore(
                category_key=key,
                label=labels.get(key, key),
                score_percent=max(1, min(100, int(round(max(value, 0.0) / total * 100)))),
            )
            for key, value in ranked
        ]
