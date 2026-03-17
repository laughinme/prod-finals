from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from random import Random
from threading import Lock

from core.config import get_settings
from domain.dating import RankedCandidate

_MAX_RANDOM_MIX_PERCENT = 80


@dataclass(slots=True)
class RandomMixState:
    random_mix_percent: int
    updated_at: datetime


class RandomMixController:
    def __init__(self, initial_percent: int = 0) -> None:
        now = datetime.now(UTC)
        self._state = RandomMixState(
            random_mix_percent=self._normalize(initial_percent),
            updated_at=now,
        )
        self._lock = Lock()

    def snapshot(self) -> RandomMixState:
        with self._lock:
            return RandomMixState(
                random_mix_percent=self._state.random_mix_percent,
                updated_at=self._state.updated_at,
            )

    def set_percent(self, value: int) -> RandomMixState:
        normalized = self._normalize(value)
        with self._lock:
            self._state.random_mix_percent = normalized
            self._state.updated_at = datetime.now(UTC)
            return RandomMixState(
                random_mix_percent=self._state.random_mix_percent,
                updated_at=self._state.updated_at,
            )

    @staticmethod
    def _normalize(value: int) -> int:
        value = int(value)
        if value < 0:
            return 0
        if value > _MAX_RANDOM_MIX_PERCENT:
            return _MAX_RANDOM_MIX_PERCENT
        return value


_controller: RandomMixController | None = None


def get_random_mix_controller() -> RandomMixController:
    global _controller
    if _controller is None:
        settings = get_settings()
        _controller = RandomMixController(
            initial_percent=int(getattr(settings, "ADMIN_RANDOM_MIX_PERCENT", 0) or 0)
        )
    return _controller


def get_random_mix_state() -> RandomMixState:
    return get_random_mix_controller().snapshot()


def set_random_mix_percent(value: int) -> RandomMixState:
    return get_random_mix_controller().set_percent(value)


def apply_random_mix(
    ranked_candidates: list[RankedCandidate],
    *,
    mix_percent: int,
) -> list[RankedCandidate]:
    if mix_percent <= 0 or len(ranked_candidates) < 3:
        return ranked_candidates

    total = len(ranked_candidates)
    protected_top = 1
    pool_indices = list(range(protected_top, total))
    max_injectable = len(pool_indices)
    inject_count = max(1, round(max_injectable * (mix_percent / 100)))
    inject_count = min(inject_count, max_injectable)
    if inject_count <= 0:
        return ranked_candidates

    rng = Random()
    selected_indices = rng.sample(pool_indices, k=inject_count)
    selected_index_set = set(selected_indices)

    selected_candidates = [ranked_candidates[index] for index in selected_indices]
    remaining = [
        ranked_candidates[index]
        for index in pool_indices
        if index not in selected_index_set
    ]
    return ranked_candidates[:protected_top] + selected_candidates + remaining
