from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import math
import random
from typing import Iterable

from .model import MatchModelArtifact, get_matches, train_profile_model
from .prepare_data import Transaction, generate_sample_transactions


@dataclass(slots=True)
class RecommendationItem:
    # Может быть числовым (bootstrap), может быть строковым (реальные id)
    candidate_user_id: str | int
    score: float


@dataclass(slots=True)
class ExplanationSignal:
    code: str
    template_key: str
    strength: str
    confidence: float


def _clamp_score(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_user_id(raw_user_id: str | int) -> str:
    # Поддерживаем числовые id (user-1) и любые строковые id (хеши, UUID и т.п.)
    if isinstance(raw_user_id, int):
        return f"user-{raw_user_id}"
    raw = str(raw_user_id)
    if raw.isdigit():
        return f"user-{raw}"
    return raw


def _resolve_profile_key(profiles: dict[str, object], user_id: str | int) -> str | None:
    key = _normalize_user_id(user_id)
    if key in profiles:
        return key
    return None


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(a * a for a in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return dot / (left_norm * right_norm)


class ModelPipeline:
    def __init__(self, artifact: MatchModelArtifact) -> None:
        self._artifact = artifact
        self.model_version = artifact.model_version
        self.features_version = "features_v1"
        self.trained_at = datetime.now(timezone.utc)

        # Храним ключи, которые уже есть в профилях, чтобы можно было быстро строить fallback-пул
        self._known_user_ids: list[str] = []
        for raw_user_id in artifact.profiles.keys():
            self._known_user_ids.append(str(raw_user_id))

    @property
    def known_user_count(self) -> int:
        return len(self._known_user_ids)

    @property
    def has_model(self) -> bool:
        return self._artifact.user_count > 0

    def recommend(
        self,
        *,
        request_user_id: str | int,
        limit: int,
        hard_exclude_user_ids: Iterable[str | int],
        soft_seen_user_ids: Iterable[str | int],
        strategy: str,
        trace_seed: int,
    ) -> tuple[list[RecommendationItem], list[str], str]:
        hard_exclude = {_normalize_user_id(x) for x in hard_exclude_user_ids}
        soft_seen = {_normalize_user_id(x) for x in soft_seen_user_ids}
        hard_exclude.add(_normalize_user_id(request_user_id))

        request_user_key = _resolve_profile_key(self._artifact.profiles, request_user_id)
        warnings: list[str] = []

        scored: list[RecommendationItem] = []
        if request_user_key is not None:
            matches = get_matches(self._artifact, request_user_key, top_n=max(200, limit * 5))
            for row in matches:
                candidate_raw = str(row["user_id"])
                candidate_key = _normalize_user_id(candidate_raw)
                if candidate_key in hard_exclude:
                    continue
                score = _clamp_score(float(row["score"]))
                if candidate_key in soft_seen:
                    score = _clamp_score(score - 0.15)
                if strategy == "high_precision":
                    score = _clamp_score(score + 0.03)
                if strategy == "exploration":
                    score = _clamp_score(score - 0.05)
                scored.append(RecommendationItem(candidate_key, score))
            decision_mode = "model"
        else:
            decision_mode = "fallback"
            warnings.append("request_user_cold_start")

        if len(scored) < limit:
            rng = random.Random(trace_seed)
            pool = [user_id for user_id in self._known_user_ids if user_id not in hard_exclude]
            rng.shuffle(pool)
            existing_ids = {item.candidate_user_id for item in scored}
            for user_id in pool:
                if user_id in existing_ids:
                    continue
                base_score = 0.45 + rng.random() * 0.2
                if user_id in soft_seen:
                    base_score -= 0.12
                scored.append(RecommendationItem(user_id, _clamp_score(base_score)))
                if len(scored) >= max(limit, 50):
                    break

        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:limit], warnings, decision_mode

    def explain_pair(
        self,
        *,
        requester_user_id: str | int,
        candidate_user_id: str | int,
        max_reasons: int,
    ) -> list[ExplanationSignal]:
        requester_key = _resolve_profile_key(self._artifact.profiles, requester_user_id)
        candidate_key = _resolve_profile_key(self._artifact.profiles, candidate_user_id)

        requester = self._artifact.profiles.get(requester_key) if requester_key else None
        candidate = self._artifact.profiles.get(candidate_key) if candidate_key else None
        if requester is None or candidate is None:
            raise LookupError("pair_not_found")

        similarity = _clamp_score(_cosine_similarity(requester.vector, candidate.vector))
        if similarity >= 0.8:
            strength = "high"
            template_suffix = "high"
        elif similarity >= 0.55:
            strength = "medium"
            template_suffix = "medium"
        else:
            strength = "low"
            template_suffix = "low"

        reasons = [
            ExplanationSignal(
                code="lifestyle_similarity",
                template_key=f"compat.lifestyle_similarity.{template_suffix}",
                strength=strength,
                confidence=_clamp_score(0.6 + similarity * 0.35),
            ),
            ExplanationSignal(
                code="activity_overlap",
                template_key=f"compat.activity_overlap.{template_suffix}",
                strength="medium" if strength == "high" else strength,
                confidence=_clamp_score(0.5 + similarity * 0.3),
            ),
            ExplanationSignal(
                code="locality_fit",
                template_key=f"compat.locality_fit.{template_suffix}",
                strength="low" if strength == "low" else "medium",
                confidence=_clamp_score(0.45 + similarity * 0.25),
            ),
            ExplanationSignal(
                code="meetup_rhythm_fit",
                template_key=f"compat.meetup_rhythm_fit.{template_suffix}",
                strength="low" if strength == "low" else "medium",
                confidence=_clamp_score(0.4 + similarity * 0.3),
            ),
        ]
        return reasons[:max_reasons]


def bootstrap_pipeline(
    *,
    user_count: int = 120,
    transactions_per_user: int = 20,
    seed: int = 42,
) -> ModelPipeline:
    transactions: list[Transaction] = generate_sample_transactions(
        user_count=user_count,
        transactions_per_user=transactions_per_user,
        seed=seed,
    )
    artifact = train_profile_model(transactions)
    return ModelPipeline(artifact)
