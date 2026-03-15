from __future__ import annotations

from domain.dating import CompatibilityReasonCode, CompatibilityReasonSignal


_REASON_LABELS: dict[str, str] = {
    CompatibilityReasonCode.MUTUAL_PREFERENCE_FIT.value: "Взаимные предпочтения совпадают",
    CompatibilityReasonCode.GOAL_FIT.value: "Совпадают цели знакомства",
    CompatibilityReasonCode.AGE_FIT.value: "Подходящий возрастной диапазон",
    CompatibilityReasonCode.CITY_FIT.value: "Подходят город и дистанция",
    CompatibilityReasonCode.CATEGORY_FIT.value: "Похожие интересы и привычки",
    CompatibilityReasonCode.PROFILE_QUALITY.value: "Качественно заполненный профиль",
}


def _clamp(value: float, *, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _strength(confidence: float) -> str:
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.6:
        return "medium"
    return "low"


def build_preview_reason_signals(
    *,
    reason_codes: list[str],
    score: float,
    max_items: int = 4,
) -> list[CompatibilityReasonSignal]:
    normalized_codes = list(dict.fromkeys(code for code in reason_codes if code))
    if not normalized_codes:
        normalized_codes = [CompatibilityReasonCode.PROFILE_QUALITY.value]

    base = _clamp(score * 0.9 + 0.08)
    signals: list[CompatibilityReasonSignal] = []
    for index, code in enumerate(normalized_codes[:max_items]):
        confidence = _clamp(base - index * 0.09)
        signals.append(
            CompatibilityReasonSignal(
                code=code,
                label=_REASON_LABELS.get(code, code),
                strength=_strength(confidence),
                confidence=round(confidence, 4),
            )
        )
    return signals
