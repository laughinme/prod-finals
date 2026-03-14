from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
import os
from pathlib import Path
from uuid import UUID

from ml.learn.model import artifact_from_json_bytes
from ml.learn.pipeline import ModelPipeline, bootstrap_pipeline
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import numpy as np

from .schemas import (
    AckResponse,
    AckStatus,
    CompatibilityExplanationRequest,
    CompatibilityExplanationResponse,
    ExplanationReason,
    ExplanationReasonCode,
    MlChecks,
    MlHealthResponse,
    MlStatus,
    PrivacyLevel,
    RecommendationCandidate,
    RecommendationDecisionMode,
    RecommendationRequest,
    RecommendationResponse,
    ReasonCode,
    ReasonSignal,
    Strength,
)


@dataclass(slots=True)
class RuntimeSettings:
    sample_user_count: int
    sample_transactions_per_user: int
    sample_seed: int
    features_version: str
    max_feedback_events_in_memory: int
    model_artifact_path: str
    qdrant_url: str
    data_path: str

    @classmethod
    def from_env(cls) -> "RuntimeSettings":
        return cls(
            sample_user_count=int(os.getenv("ML_SAMPLE_USER_COUNT", "120")),
            sample_transactions_per_user=int(os.getenv("ML_SAMPLE_TX_PER_USER", "20")),
            sample_seed=int(os.getenv("ML_SAMPLE_SEED", "42")),
            features_version=os.getenv("ML_FEATURES_VERSION", "features_v1"),
            max_feedback_events_in_memory=int(os.getenv("ML_MAX_FEEDBACK_EVENTS", "10000")),
            model_artifact_path=os.getenv("ML_MODEL_ARTIFACT_PATH", "/app/ml/artifacts/model.json"),
            qdrant_url=os.getenv("QDRANT_URL", "http://qdrant:6333"),
            data_path=os.getenv("ML_TRAIN_DATA_PATH", "/app/ml/data/train.csv"),
        )

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _strength_by_score(score: float) -> Strength:
    if score >= 0.8:
        return Strength.high
    if score >= 0.55:
        return Strength.medium
    return Strength.low


def _reason_signals_by_score(score: float, fallback_mode: bool) -> list[ReasonSignal]:
    strength = _strength_by_score(score)
    first = ReasonSignal(
        code=ReasonCode.lifestyle_similarity,
        strength=strength,
        confidence=max(0.0, min(1.0, 0.55 + score * 0.4)),
    )
    second = ReasonSignal(
        code=ReasonCode.activity_overlap,
        strength=Strength.medium if strength == Strength.high else strength,
        confidence=max(0.0, min(1.0, 0.45 + score * 0.35)),
    )
    if fallback_mode:
        return [
            ReasonSignal(
                code=ReasonCode.novelty_boost,
                strength=Strength.medium,
                confidence=max(0.0, min(1.0, 0.4 + score * 0.25)),
            ),
            second,
        ]
    return [first, second]


class MlRuntime:
    def __init__(self, settings: RuntimeSettings | None = None) -> None:
        self._settings = settings or RuntimeSettings.from_env()
        self._feedback_events: deque[dict[str, str]] = deque(
            maxlen=self._settings.max_feedback_events_in_memory
        )
        self._startup_error: str | None = None
        self._loaded_from_artifact = False
        self._pipeline: ModelPipeline | None = None

        try:
            self._qdrant_client = QdrantClient(url=self._settings.qdrant_url)
        except Exception as exc:
            self._qdrant_client = None
            self._startup_error = f"Qdrant connection failed: {exc}"

        try:
            self._pipeline = self._build_pipeline()
        except Exception as exc:
            self._pipeline = None
            if self._startup_error:
                self._startup_error = f"{self._startup_error}; pipeline init failed: {exc}"
            else:
                self._startup_error = f"Pipeline init failed: {exc}"
            
    def _build_pipeline(self) -> ModelPipeline:
        artifact_path = Path(self._settings.model_artifact_path)
        if artifact_path.exists():
            artifact = artifact_from_json_bytes(artifact_path.read_bytes())
            self._loaded_from_artifact = True
            return ModelPipeline(artifact)

        self._loaded_from_artifact = False
        return bootstrap_pipeline(
            user_count=self._settings.sample_user_count,
            transactions_per_user=self._settings.sample_transactions_per_user,
            seed=self._settings.sample_seed,
        )

    @property
    def model_version(self) -> str:
        if self._pipeline is None:
            return "ranker_unavailable"
        return self._pipeline.model_version

    def get_health(self) -> MlHealthResponse:
        is_ready = self._pipeline is not None and self._pipeline.has_model
        warnings: list[str] = []
        status = MlStatus.ok
        decision_mode = "model"

        if not is_ready:
            status = MlStatus.down
            decision_mode = "fallback_only"
            if self._startup_error:
                warnings.append("ranker_init_failed")

        if is_ready and self._pipeline is not None and self._pipeline.known_user_count < 50:
            status = MlStatus.degraded
            warnings.append("candidate_pool_low")

        if is_ready and not self._loaded_from_artifact:
            warnings.append("artifact_missing_using_bootstrap")

        checks = MlChecks(
            ranker_loaded=is_ready,
            explainer_loaded=is_ready,
            feedback_ingest=True,
        )
        return MlHealthResponse(
            status=status,
            timestamp=_utcnow(),
            decision_mode=decision_mode,
            model_version=self.model_version,
            features_version=self._settings.features_version,
            checks=checks,
            warnings=warnings,
        )

    def recommend(self, request: RecommendationRequest) -> RecommendationResponse:
        trace_seed = request.trace_id.int % (2**32)
        hard_exclude = request.exclusion.hard_exclude_user_ids if request.exclusion else []
        soft_seen = request.exclusion.soft_seen_user_ids if request.exclusion else []
        soft_seen_set = set(soft_seen or [])

        warnings: list[str] = []
        decision_mode = RecommendationDecisionMode.fallback
        candidates: list[RecommendationCandidate] = []

        if self._pipeline is not None:
            items, runtime_warnings, runtime_decision_mode = self._pipeline.recommend(
                request_user_id=request.request_user_id,
                limit=request.limit,
                hard_exclude_user_ids=hard_exclude or [],
                soft_seen_user_ids=soft_seen or [],
                strategy=request.strategy.value,
                trace_seed=trace_seed,
            )
            warnings.extend(runtime_warnings)
            decision_mode = RecommendationDecisionMode(runtime_decision_mode)

            for item in items:
                is_soft_seen = item.candidate_user_id in soft_seen_set
                fallback_mode = decision_mode == RecommendationDecisionMode.fallback
                policy_flags = []
                if is_soft_seen:
                    policy_flags.append("cooldown_candidate")
                if fallback_mode:
                    policy_flags.append("sparse_behavioral_data")

                candidates.append(
                    RecommendationCandidate(
                        candidate_user_id=item.candidate_user_id,
                        score=round(item.score, 4),
                        reason_signals=_reason_signals_by_score(item.score, fallback_mode=fallback_mode),
                        policy_flags=policy_flags,
                    )
                )
        else:
            warnings.append("ranker_unavailable")

        return RecommendationResponse(
            trace_id=request.trace_id,
            generated_at=_utcnow(),
            model_version=self.model_version,
            features_version=self._settings.features_version,
            decision_mode=decision_mode,
            warnings=warnings,
            candidates=candidates,
        )

    def explain_compatibility(
        self,
        request: CompatibilityExplanationRequest,
    ) -> CompatibilityExplanationResponse:
        if self._pipeline is None:
            raise LookupError("pipeline_unavailable")

        signals = self._pipeline.explain_pair(
            requester_user_id=request.requester_user_id,
            candidate_user_id=request.candidate_user_id,
            max_reasons=request.max_reasons,
        )

        reasons = [
            ExplanationReason(
                code=ExplanationReasonCode(item.code),
                template_key=item.template_key,
                strength=Strength(item.strength),
                confidence=round(item.confidence, 4),
            )
            for item in signals
        ]

        return CompatibilityExplanationResponse(
            trace_id=request.trace_id,
            candidate_user_id=request.candidate_user_id,
            privacy_level=PrivacyLevel.safe_aggregate,
            reasons=reasons,
            privacy_checks=[
                "aggregate_only",
                "no_raw_merchants",
                "no_amounts",
            ],
        )

    def save_feedback_event(self, *, event_id: UUID, trace_id: UUID, event_type: str) -> AckResponse:
        self._feedback_events.append(
            {
                "event_id": str(event_id),
                "trace_id": str(trace_id),
                "event_type": event_type,
                "received_at": _utcnow().isoformat(),
            }
        )
        return AckResponse(status=AckStatus.accepted, received_at=_utcnow())
    def update_user_profile_favorites(
        self, 
        user_id: int, 
        favorite_categories: list[str], 
        trace_id: UUID,
        preferred_hour: float | None = None
    ) -> AckResponse:
        """
        Обрабатывает выбранные юзером любимые категории.
        Смешивает их с историей (если есть) или создает вектор с нуля для холодных юзеров.
        """
        if self._qdrant_client is None:
            # Если Qdrant упал, просто логируем (в реальном проекте тут нужна очередь/Kafka)
            print(f"[{trace_id}] Cannot update user {user_id}, Qdrant is down.")
            return AckResponse(status=AckStatus.accepted, received_at=_utcnow())

        # ВАЖНО: Тебе нужен доступ к списку ВСЕХ уникальных категорий (например, из pipeline или настроек)
        # Предположим, он хранится в self._pipeline.all_categories
        if self._pipeline is None or not hasattr(self._pipeline, 'all_categories'):
            print(f"[{trace_id}] ML Pipeline is not ready. Cannot vectorize profile.")
            return AckResponse(status=AckStatus.accepted, received_at=_utcnow())

        all_categories = self._pipeline.all_categories
        


        is_warm = self._pipeline.has_user_history(user_id) 


        raw_vector = np.zeros(len(all_categories))
        
        if not is_warm:


            weight_per_cat = 1.0 / len(favorite_categories)
            for idx, cat in enumerate(all_categories):
                if cat in favorite_categories:
                    raw_vector[idx] = weight_per_cat
            

            hour = preferred_hour if preferred_hour is not None else 14.0
            
        else:
            existing_vector, existing_hour = self._pipeline.get_raw_user_profile(user_id)
            
            history_weight = 0.7
            favorites_weight = 0.3
            

            fav_vector = np.zeros(len(all_categories))
            weight_per_cat = 1.0 / len(favorite_categories)
            for idx, cat in enumerate(all_categories):
                if cat in favorite_categories:
                    fav_vector[idx] = weight_per_cat

            # Смешиваем
            raw_vector = (existing_vector * history_weight) + (fav_vector * favorites_weight)
            

            hour = existing_hour

        final_raw_features = np.append(raw_vector, hour)




        scaled_vector = self._pipeline.scaler.transform([final_raw_features])[0]

        collection_name = "user_profiles" # Вынести в settings
        
        self._qdrant_client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=user_id,
                    vector=scaled_vector.tolist(),
                    payload={
                        "is_warm": is_warm,
                        "updated_at": _utcnow().isoformat()
                    }
                )
            ]
        )

        return AckResponse(status=AckStatus.accepted, received_at=_utcnow())
