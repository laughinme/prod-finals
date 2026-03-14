from datetime import date

from domain.dating import (
    CompatibilityExplanationResponse,
    CompatibilityPreview,
    CompatibilityReason,
    CompatibilityReasonCode,
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
from domain.dating.quiz_catalog import get_option_label


def _age_for_birth_date(birth_date: date | None, today: date) -> int | None:
    if birth_date is None:
        return None
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


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

            if requester.city and candidate.city and requester.city == candidate.city:
                score += 0.20
                reason_codes.append(CompatibilityReasonCode.CITY_FIT)

            if self._has_mutual_gender_fit(requester, candidate):
                score += 0.22
                reason_codes.append(CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT)

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

            overlap = sorted(set(requester.lifestyle_codes) & set(candidate.lifestyle_codes))
            if overlap:
                score += min(0.18, 0.06 * len(overlap))
                reason_codes.append(CompatibilityReasonCode.LIFESTYLE_OVERLAP)

            if requester.has_behavioral_profile and candidate.has_behavioral_profile:
                score += 0.10
                reason_codes.append(CompatibilityReasonCode.BEHAVIORAL_SIGNAL)

            completion_bonus = min(candidate.profile_completion_percent / 1000, 0.10)
            if completion_bonus:
                score += completion_bonus
                reason_codes.append(CompatibilityReasonCode.PROFILE_QUALITY)

            scored.append(
                RankedCandidate(
                    candidate_user_id=candidate.user_id,
                    score=round(min(score, 0.99), 2),
                    reason_codes=reason_codes[:4] or [CompatibilityReasonCode.CITY_FIT],
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        return RankedCandidates(
            decision_mode=DecisionMode.FALLBACK,
            candidates=scored[:limit],
        )

    async def explain(self, payload: ExplanationRequest) -> CompatibilityExplanationResponse:
        ranked = await self.rank(payload.requester, [payload.candidate], limit=1)
        scored = ranked.candidates[0]
        reasons = [
            self._reason_from_code(code, payload.requester, payload.candidate)
            for code in scored.reason_codes[:3]
        ]
        return CompatibilityExplanationResponse(
            serve_item_id=payload.serve_item_id,
            candidate_user_id=payload.candidate.user_id,
            reasons=reasons,
            disclaimer="These explanations use aggregated profile and quiz signals only.",
        )

    def build_preview(self, scored: RankedCandidate) -> CompatibilityPreview:
        reason_codes = [
            code if isinstance(code, CompatibilityReasonCode) else CompatibilityReasonCode(code)
            for code in scored.reason_codes
        ]
        primary = reason_codes[0]
        preview_map = {
            CompatibilityReasonCode.CITY_FIT: "You are aligned on city rhythm and logistics.",
            CompatibilityReasonCode.AGE_FIT: "Your expected age ranges align both ways.",
            CompatibilityReasonCode.GOAL_FIT: "You are looking for a similar kind of connection.",
            CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT: "Your mutual preferences line up well.",
            CompatibilityReasonCode.LIFESTYLE_OVERLAP: "There is a clear overlap in lifestyle signals.",
            CompatibilityReasonCode.BEHAVIORAL_SIGNAL: "Behavioral patterns point to a stronger fit.",
            CompatibilityReasonCode.PROFILE_QUALITY: "This profile gives enough signal for a confident match.",
        }
        return CompatibilityPreview(
            score=scored.score,
            preview=preview_map[primary],
            reason_codes=[code.value for code in reason_codes],
            details_available=True,
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
        shared = sorted(set(requester.lifestyle_codes) & set(candidate.lifestyle_codes))
        items: list[Icebreaker] = []
        for code in shared[:3]:
            items.append(
                Icebreaker(
                    icebreaker_id=code,
                    text=f"Ask about {get_option_label(code).lower()}.",
                    reason=f"Shared lifestyle signal: {get_option_label(code)}",
                )
            )
        if not items:
            items = [
                Icebreaker(
                    icebreaker_id="weekend_opening",
                    text="What does a great weekend look like for you?",
                    reason="A safe generic opener for a new conversation.",
                ),
                Icebreaker(
                    icebreaker_id="city_opening",
                    text="What place in your city would you happily revisit together?",
                    reason="Works well when both profiles are local.",
                ),
                Icebreaker(
                    icebreaker_id="food_opening",
                    text="What is your current comfort food or cafe pick?",
                    reason="Easy first-message topic with low pressure.",
                ),
            ]
        return IcebreakersResponse(items=items[:3])

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

    def _reason_from_code(
        self,
        code: CompatibilityReasonCode,
        requester: FeedCandidateContext,
        candidate: FeedCandidateContext,
    ) -> CompatibilityReason:
        mapping = {
            CompatibilityReasonCode.CITY_FIT: (
                "Similar city rhythm",
                "You appear to be in a compatible local context for actually meeting offline.",
                0.78,
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
            CompatibilityReasonCode.LIFESTYLE_OVERLAP: (
                "Lifestyle overlap",
                "Optional quiz signals point to overlapping habits and social pace.",
                0.72,
            ),
            CompatibilityReasonCode.BEHAVIORAL_SIGNAL: (
                "Behavioral signal",
                "Additional behavioral context increases confidence in this recommendation.",
                0.69,
            ),
            CompatibilityReasonCode.PROFILE_QUALITY: (
                "Strong profile signal",
                "The profile contains enough detail to support a more stable recommendation.",
                0.63,
            ),
        }
        title, text, confidence = mapping[code]
        return CompatibilityReason(code=code.value, title=title, text=text, confidence=confidence)
