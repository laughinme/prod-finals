from datetime import date

from domain.dating import (
    CompatibilityExplanationResponse,
    CompatibilityMode,
    CompatibilityPreview,
    CompatibilityReason,
    CompatibilityReasonCode,
    FeedDecisionMode,
    FeedEmptyState,
    FeedEmptyStateCode,
    MlCandidateScore,
    MlReasonSignal,
    MockExplanationRequest,
    MockRecommendationRequest,
    MockRecommendationResponse,
)
from domain.users.enums import Gender


def _age_for_birth_date(birth_date: date, today: date) -> int:
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


class MlFacade:
    async def rank(self, payload: MockRecommendationRequest) -> MockRecommendationResponse:
        raise NotImplementedError

    async def explain(self, payload: MockExplanationRequest) -> CompatibilityExplanationResponse:
        raise NotImplementedError


class MockMlFacade(MlFacade):
    async def rank(self, payload: MockRecommendationRequest) -> MockRecommendationResponse:
        today = date.today()
        scored: list[MlCandidateScore] = []
        for candidate in payload.candidates:
            score = 0.1
            reason_signals: list[MlReasonSignal] = []

            reciprocal_gender_fit = bool(
                payload.requester.gender
                and candidate.gender
                and candidate.gender in payload.requester.looking_for_genders
                and payload.requester.gender in candidate.looking_for_genders
            )
            if reciprocal_gender_fit:
                score += 0.28
                reason_signals.append(
                    MlReasonSignal(
                        code=CompatibilityReasonCode.COMMUNICATION_STYLE_FIT,
                        strength="high",
                        confidence=0.86,
                    )
                )

            if payload.requester.city_id == candidate.city_id:
                score += 0.22
                reason_signals.append(
                    MlReasonSignal(
                        code=CompatibilityReasonCode.LOCALITY_FIT,
                        strength="high",
                        confidence=0.82,
                    )
                )

            if payload.requester.goal and candidate.goal and payload.requester.goal == candidate.goal:
                score += 0.18
                reason_signals.append(
                    MlReasonSignal(
                        code=CompatibilityReasonCode.MEETUP_RHYTHM_FIT,
                        strength="medium",
                        confidence=0.74,
                    )
                )

            requester_age = _age_for_birth_date(payload.requester.birth_date, today)
            candidate_age = _age_for_birth_date(candidate.birth_date, today)
            requester_age_fit = bool(
                payload.requester.age_range
                and payload.requester.age_range.min <= candidate_age <= payload.requester.age_range.max
            )
            candidate_age_fit = bool(
                candidate.age_range and candidate.age_range.min <= requester_age <= candidate.age_range.max
            )
            if requester_age_fit and candidate_age_fit:
                score += 0.17
                reason_signals.append(
                    MlReasonSignal(
                        code=CompatibilityReasonCode.LIFESTYLE_SIMILARITY,
                        strength="medium",
                        confidence=0.72,
                    )
                )

            if payload.requester.bio and candidate.bio:
                score += 0.08
                reason_signals.append(
                    MlReasonSignal(
                        code=CompatibilityReasonCode.ACTIVITY_OVERLAP,
                        strength="medium",
                        confidence=0.69,
                    )
                )

            if candidate.has_min_profile and candidate.has_approved_photo:
                score += 0.07

            scored.append(
                MlCandidateScore(
                    candidate_user_id=candidate.user_id,
                    score=min(score, 0.99),
                    reason_signals=reason_signals[:5] or [
                        MlReasonSignal(
                            code=CompatibilityReasonCode.LOCALITY_FIT,
                            strength="low",
                            confidence=0.55,
                        )
                    ],
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        return MockRecommendationResponse(
            decision_mode=FeedDecisionMode.FALLBACK,
            candidates=scored[: payload.limit],
        )

    async def explain(self, payload: MockExplanationRequest) -> CompatibilityExplanationResponse:
        ranked = await self.rank(
            MockRecommendationRequest(
                requester=payload.requester,
                candidates=[payload.candidate],
                limit=1,
            )
        )
        candidate = ranked.candidates[0]
        reasons = [self._build_reason(signal.code, signal.confidence) for signal in candidate.reason_signals[: payload.max_reasons]]
        return CompatibilityExplanationResponse(
            serve_item_id=payload.candidate.user_id,  # overwritten by service
            candidate_user_id=payload.candidate.user_id,
            mode=CompatibilityMode.BASIC_FALLBACK,
            reasons=reasons,
        )

    def build_preview(self, scored: MlCandidateScore) -> CompatibilityPreview:
        preview_texts = {
            CompatibilityReasonCode.LIFESTYLE_SIMILARITY: "У вас похожий ритм жизни и ожидания от знакомства.",
            CompatibilityReasonCode.ACTIVITY_OVERLAP: "Есть заметное пересечение по повседневным интересам.",
            CompatibilityReasonCode.COMMUNICATION_STYLE_FIT: "Похоже, вы совпадаете по формату общения и знакомств.",
            CompatibilityReasonCode.MEETUP_RHYTHM_FIT: "Ваш темп знакомства и офлайн-встреч выглядит совместимым.",
            CompatibilityReasonCode.LOCALITY_FIT: "Вам будет проще пересечься благодаря близкому ритму города.",
        }
        reason_codes = [
            signal.code if isinstance(signal.code, CompatibilityReasonCode) else CompatibilityReasonCode(signal.code)
            for signal in scored.reason_signals[:5]
        ]
        primary = reason_codes[0]
        return CompatibilityPreview(
            score=round(scored.score, 2),
            mode=CompatibilityMode.BASIC_FALLBACK,
            preview=preview_texts[primary],
            reason_codes=reason_codes,
            details_available=True,
        )

    def empty_state(self, code: FeedEmptyStateCode) -> FeedEmptyState:
        mapping = {
            FeedEmptyStateCode.NO_CANDIDATES_NOW: (
                "Пока нет новых кандидатов",
                "Попробуйте зайти позже, когда появятся новые совместимые анкеты.",
            ),
            FeedEmptyStateCode.DAILY_BATCH_EXHAUSTED: (
                "Сегодняшняя выдача закончилась",
                "Возвращайтесь завтра за новой подборкой.",
            ),
            FeedEmptyStateCode.PHOTO_PENDING: (
                "Ждём подтверждения фото",
                "Как только фото станет доступным, выдача откроется автоматически.",
            ),
            FeedEmptyStateCode.PROFILE_INCOMPLETE: (
                "Профиль ещё не готов",
                "Заполните обязательные поля профиля, чтобы открыть выдачу.",
            ),
        }
        title, message = mapping[code]
        return FeedEmptyState(code=code, title=title, message=message)

    def _build_reason(
        self,
        code: CompatibilityReasonCode,
        confidence: float,
    ) -> CompatibilityReason:
        mapping = {
            CompatibilityReasonCode.LIFESTYLE_SIMILARITY: (
                "Похожий ритм жизни",
                "Ваши привычные сценарии досуга и темп жизни достаточно близки.",
            ),
            CompatibilityReasonCode.ACTIVITY_OVERLAP: (
                "Есть пересечение по интересам",
                "У вас заметно пересекаются устойчивые интересы и форматы отдыха.",
            ),
            CompatibilityReasonCode.COMMUNICATION_STYLE_FIT: (
                "Похожий стиль знакомства",
                "Вы оба похожим образом подходите к общению и ожиданиям от контакта.",
            ),
            CompatibilityReasonCode.MEETUP_RHYTHM_FIT: (
                "Совпадает темп встреч",
                "Ваши ожидания по тому, как быстро переходить к встрече, выглядят совместимыми.",
            ),
            CompatibilityReasonCode.LOCALITY_FIT: (
                "Близкий городской ритм",
                "У вас похожая география повседневной жизни, поэтому легче пересечься.",
            ),
        }
        title, text = mapping[code]
        return CompatibilityReason(code=code, title=title, text=text, confidence=round(confidence, 2))
