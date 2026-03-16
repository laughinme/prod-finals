from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import os
from pathlib import Path
from uuid import UUID, uuid5, NAMESPACE_DNS
import joblib
import pandas as pd
from catboost import CatBoostClassifier
from ml.learn.model import artifact_from_json_bytes
from ml.learn.pipeline import ModelPipeline, bootstrap_pipeline
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchAny, PointStruct
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
    SwipeFeedbackRequest,
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


def _string_to_uuid(string: str) -> str:
    return str(uuid5(NAMESPACE_DNS, string))


def _normalize_user_id(user_id: str | int) -> str:
    """Normalize user IDs to ensure string representation for Qdrant hashing."""
    return str(user_id).strip().lower()


def _fallback_profile_vector(
    *,
    favorite_categories: list[str],
    preferred_hour: float | None,
    vector_size: int,
) -> list[float]:
    if vector_size <= 0:
        return []

    vector = np.zeros(vector_size, dtype=float)
    hour_index = max(vector_size - 1, 0)

    normalized_categories = [
        str(category).strip().lower()
        for category in favorite_categories
        if str(category).strip()
    ]
    for rank, category in enumerate(normalized_categories[:5], start=1):
        digest = sha256(category.encode("utf-8")).digest()
        feature_space = max(vector_size - 1, 1)
        index = int.from_bytes(digest[:4], "big") % feature_space
        vector[index] += 1.0 / rank

    if vector_size >= 1:
        hour_value = preferred_hour if preferred_hour is not None else 14.0
        vector[hour_index] = (float(hour_value) - 12.0) / 12.0

    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return [float(value) for value in vector]


class MlRuntime:
    def __init__(self, settings: RuntimeSettings | None = None) -> None:
        self._settings = settings or RuntimeSettings.from_env()
        self._feedback_events: deque[dict[str, str]] = deque(
            maxlen=self._settings.max_feedback_events_in_memory
        )
        self._startup_error: str | None = None
        self._loaded_from_artifact = False
        self._pipeline: ModelPipeline | None = None
        self._load_inference_artifacts()

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
    def _load_inference_artifacts(self):
        models_dir = Path("/app/ml/models") 
        try:
            self._scaler = joblib.load(models_dir / "scaler.joblib")
            self._features_list = joblib.load(models_dir / "features_list.joblib")
            
            self._catboost = CatBoostClassifier()
            self._catboost.load_model(models_dir / "imputer.cbm") 
            self._has_artifacts = True
            print("✅ ML Artifacts loaded successfully")
        except Exception as e:
            self._has_artifacts = False
            self._startup_error = f"Artifacts not found: {e}"
            print("⚠️ Running in fallback mode without CatBoost/Scaler")
    def update_user_profile_favorites(
        self, 
        user_id: str | int, 
        favorite_categories: list[str], 
        trace_id: UUID,
        preferred_hour: float | None = None,
        import_transactions: bool = False,
    ) -> AckResponse:
        if self._qdrant_client is None:
            return AckResponse(status=AckStatus.accepted, received_at=_utcnow())
        user_uuid = _string_to_uuid(_normalize_user_id(user_id))

        existing_points = self._qdrant_client.retrieve(
            collection_name="user_profiles",
            ids=[user_uuid],
            with_vectors=True,
            with_payload=True,
        )
        existing_vector = existing_points[0].vector if existing_points else None
        existing_payload = dict(existing_points[0].payload or {}) if existing_points else {}

        if self._has_artifacts:
            raw_vector = np.zeros(len(self._features_list))
            weight_per_cat = 1.0 / len(favorite_categories) if favorite_categories else 0

            for cat in favorite_categories:
                if cat in self._features_list:
                    idx = self._features_list.index(cat)
                    raw_vector[idx] = weight_per_cat
            if "hour" in self._features_list:
                hour_idx = self._features_list.index("hour")
                raw_vector[hour_idx] = preferred_hour if preferred_hour is not None else 14.0
            scaled_vector = self._scaler.transform([raw_vector])[0]

            if import_transactions and existing_vector is not None and existing_payload.get("is_warm"):
                blended_vector = [
                    float((0.35 * cold_value) + (0.65 * warm_value))
                    for cold_value, warm_value in zip(scaled_vector, existing_vector)
                ]
                norm = np.linalg.norm(blended_vector)
                if norm > 0:
                    scaled_vector = np.array([float(value / norm) for value in blended_vector], dtype=float)
        else:
            vector_size = len(existing_vector) if existing_vector is not None else 35
            scaled_vector = _fallback_profile_vector(
                favorite_categories=favorite_categories,
                preferred_hour=preferred_hour,
                vector_size=vector_size,
            )

        self._qdrant_client.upsert(
            collection_name="user_profiles",
            points=[
                PointStruct(
                    id=user_uuid,
                    vector=scaled_vector.tolist() if hasattr(scaled_vector, "tolist") else list(scaled_vector),
                    payload={
                        "party_rk": str(user_id),
                        "is_warm": bool(import_transactions and existing_payload.get("is_warm")),
                        "favorite_categories": list(favorite_categories),
                        "preferred_activity_hour": preferred_hour if preferred_hour is not None else 14.0,
                        "import_transactions_enabled": bool(import_transactions),
                        "top_cat": favorite_categories[0] if favorite_categories else existing_payload.get("top_cat", "unknown"),
                        "transactions_count": existing_payload.get("transactions_count", 0),
                        "updated_at": _utcnow().isoformat()
                    }
                )
            ]
        )
        print(f"[{trace_id}] Cold start profile generated for user {user_id}")
        return AckResponse(status=AckStatus.accepted, received_at=_utcnow())
    def process_transactions_sync_background(self, payload: Any):
        from ml.service.schemas import TransactionSyncRequest 
        request: TransactionSyncRequest = payload

        if not self._has_artifacts or self._qdrant_client is None:
            return

        user_id_str = str(request.user_id)

        df = pd.DataFrame([t.model_dump() for t in request.transactions])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        predict_df = df[df['category_nm'].isna() | (df['category_nm'] == '')].copy()
        if not predict_df.empty:
            preds = self._catboost.predict(predict_df[['merchant_type_code', 'merchant_nm', 'hour', 'day_of_week']])
            df.loc[predict_df.index, 'category_nm'] = preds.flatten()
        cat_counts = df['category_nm'].value_counts()
        total = cat_counts.sum()
        
        raw_vector = np.zeros(len(self._features_list))
        for cat, count in cat_counts.items():
            if cat in self._features_list:
                idx = self._features_list.index(cat)
                raw_vector[idx] = count / total if total > 0 else 0
        if "hour" in self._features_list:
            hour_idx = self._features_list.index("hour")
            raw_vector[hour_idx] = df['hour'].mean()
        scaled_vector = self._scaler.transform([raw_vector])[0]
        user_uuid = _string_to_uuid(_normalize_user_id(request.user_id))
        
        top_cat = df['category_nm'].mode().iloc[0] if not df['category_nm'].empty else "unknown"

        self._qdrant_client.upsert(
            collection_name="user_profiles",
            points=[
                PointStruct(
                    id=user_uuid,
                    vector=scaled_vector.tolist(),
                    payload={
                        "party_rk": user_id_str,
                        "is_warm": True, 
                        "top_cat": top_cat,
                        "transactions_count": len(df),
                        "updated_at": _utcnow().isoformat()
                    }
                )
            ]
        )
        print(f"[{request.trace_id}] Vectors synchronized dynamically for user {user_id_str}")

    def pull_and_process_user_transactions(self, *, user_id: str | int, trace_id: UUID) -> None:
        # External banking pull is not wired in this deployment; keep endpoint non-breaking.
        print(f"[{trace_id}] Transaction pull skipped for user {user_id}: source is not configured")

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
        soft_seen_set = {_normalize_user_id(user_id) for user_id in (soft_seen or [])}
        candidate_pool_ids = (
            {_normalize_user_id(user_id) for user_id in request.candidate_user_ids}
            if request.candidate_user_ids
            else None
        )

        warnings: list[str] = []
        decision_mode = RecommendationDecisionMode.fallback
        candidates: list[RecommendationCandidate] = []
        if self._qdrant_client is not None:
            qdrant_candidates = self._recommend_via_qdrant(
                request_user_id=request.request_user_id,
                limit=request.limit,
                hard_exclude_user_ids=hard_exclude or [],
                soft_seen_user_ids=soft_seen or [],
                candidate_user_ids=request.candidate_user_ids or [],
                strategy=request.strategy.value,
                trace_seed=trace_seed,
            )
            if qdrant_candidates:
                decision_mode = RecommendationDecisionMode.model
                for item in qdrant_candidates:
                    is_soft_seen = _normalize_user_id(item.candidate_user_id) in soft_seen_set
                    policy_flags = []
                    if is_soft_seen:
                        policy_flags.append("cooldown_candidate")
                    candidates.append(
                        RecommendationCandidate(
                            candidate_user_id=item.candidate_user_id,
                            score=round(item.score, 4),
                            score_components=item.score_components,
                            reason_signals=_reason_signals_by_score(item.score, fallback_mode=False),
                            policy_flags=policy_flags,
                        )
                    )
            else:
                warnings.append("qdrant_unavailable_fallback_to_model")
        else:
            warnings.append("qdrant_unavailable")

        # Fallback к модели, если Qdrant не сработал
        if not candidates and self._pipeline is not None:
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
                normalized_candidate_id = _normalize_user_id(item.candidate_user_id)
                if candidate_pool_ids is not None and normalized_candidate_id not in candidate_pool_ids:
                    continue
                is_soft_seen = normalized_candidate_id in soft_seen_set
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
        elif not candidates:
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

    def _recommend_via_qdrant(
        self,
        *,
        request_user_id: str | int,
        limit: int,
        hard_exclude_user_ids: Iterable[str | int],
        soft_seen_user_ids: Iterable[str | int],
        candidate_user_ids: Iterable[str | int],
        strategy: str,
        trace_seed: int,
    ) -> list[RecommendationCandidate]:
        """
        Ищет рекомендации через Qdrant, используя обновленные векторы (с дообучением).
        """
        try:
            # Получаем вектор пользователя
            user_id_str = _string_to_uuid(_normalize_user_id(request_user_id))
            user_points = self._qdrant_client.retrieve(
                collection_name="user_profiles",
                ids=[user_id_str],
                with_vectors=True,
                with_payload=True,
            )
            if not user_points:
                return []  # Пользователь не найден в Qdrant
            user_vector = user_points[0].vector
            user_payload = dict(user_points[0].payload or {})

            # Исключаем hard_exclude
            exclude_ids = {_string_to_uuid(_normalize_user_id(uid)) for uid in hard_exclude_user_ids}
            exclude_ids.add(user_id_str)  # Исключаем самого себя
            allowed_ids = [_normalize_user_id(uid) for uid in candidate_user_ids]
            query_filter = None
            if allowed_ids:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="party_rk",
                            match=MatchAny(any=allowed_ids),
                        )
                    ]
                )

            # Ищем ближайших в Qdrant
            search_limit = (
                max(limit * 3, min(max(len(allowed_ids), limit), 2000))
                if allowed_ids
                else limit * 2
            )
            search_result = self._qdrant_client.query_points(
                collection_name="user_profiles",
                query=user_vector,
                query_filter=query_filter,
                limit=search_limit,  # Больше, чтобы учесть фильтры
                with_payload=True,
                with_vectors=True,
            )

            items = []
            for hit in search_result.points:
                if hit.id in exclude_ids:
                    continue
                # Преобразуем id обратно в user_id (из payload или из id)
                # Предполагаем, что id - это uuid от party_rk, и payload содержит party_rk
                candidate_user_id = hit.payload.get("party_rk", str(hit.id))
                # Qdrant cosine similarity may be in [-1, 1], while our API contract
                # and downstream UI expect a normalized 0..1 compatibility score.
                score = (float(hit.score) + 1.0) / 2.0
                # Применяем стратегию
                if strategy == "high_precision":
                    score = min(1.0, score + 0.03)
                elif strategy == "exploration":
                    score = max(0.0, score - 0.05)
                # Soft seen
                if _normalize_user_id(candidate_user_id) in {_normalize_user_id(uid) for uid in soft_seen_user_ids}:
                    score = max(0.0, score - 0.15)
                # Ensure we return a structured item
                from .schemas import RecommendationCandidate
                items.append(RecommendationCandidate(
                    candidate_user_id=candidate_user_id, 
                    score=score,
                    score_components=self._build_score_components(
                        requester_vector=user_vector,
                        candidate_vector=hit.vector,
                        fallback_top_cat=hit.payload.get("top_cat") if hit.payload else None,
                        requester_payload=user_payload,
                        candidate_payload=dict(hit.payload or {}),
                    ),
                    reason_signals=_reason_signals_by_score(score, fallback_mode=False),
                    policy_flags=[]
                ))
                if len(items) >= limit:
                    break

            return items
        except Exception as exc:
            print(f"Qdrant search failed: {exc}")
            return []

    def _build_score_components(
        self,
        *,
        requester_vector: list[float] | tuple[float, ...] | np.ndarray,
        candidate_vector: list[float] | tuple[float, ...] | np.ndarray,
        fallback_top_cat: str | None = None,
        requester_payload: dict[str, object] | None = None,
        candidate_payload: dict[str, object] | None = None,
    ) -> dict[str, float]:
        if not self._has_artifacts:
            requester_categories = {
                str(item).strip()
                for item in ((requester_payload or {}).get("favorite_categories") or [])
                if str(item).strip()
            }
            candidate_categories = [
                str(item).strip()
                for item in ((candidate_payload or {}).get("favorite_categories") or [])
                if str(item).strip()
            ]
            overlap = [item for item in candidate_categories if item in requester_categories]
            if overlap:
                weight = round(1.0 / len(overlap), 4)
                return {item: weight for item in overlap[:5]}
            return {fallback_top_cat: 1.0} if fallback_top_cat else {}

        components: list[tuple[str, float]] = []
        for index, feature_name in enumerate(self._features_list):
            if feature_name == "hour":
                continue
            try:
                requester_value = float(requester_vector[index])
                candidate_value = float(candidate_vector[index])
            except (IndexError, TypeError, ValueError):
                continue
            overlap = max(0.0, requester_value * candidate_value)
            if overlap <= 0:
                continue
            components.append((str(feature_name), overlap))

        if not components:
            return {fallback_top_cat: 1.0} if fallback_top_cat else {}

        ranked = sorted(components, key=lambda item: item[1], reverse=True)[:5]
        total = sum(score for _, score in ranked) or 1.0
        return {
            key: round(score / total, 4)
            for key, score in ranked
        }

    def process_swipe_feedback(self, payload: SwipeFeedbackRequest) -> AckResponse:
        # Сохраняем событие
        self.save_feedback_event(
            event_id=payload.event_id,
            trace_id=payload.trace_id,
            event_type="swipe",
        )
        
        # Обновляем вектор на основании лайка или дизлайка
        if payload.action in ("like", "pass") and self._qdrant_client is not None:
            self._update_user_vector_on_swipe(payload.actor_user_id, payload.target_user_id, payload.action, payload.trace_id)
        
        return AckResponse(status=AckStatus.accepted, received_at=_utcnow())

    def _update_user_vector_on_swipe(self, actor_user_id: str | int, target_user_id: str | int, action: str, trace_id: UUID) -> None:
        """
        Обновляет вектор актора: если лайк - приближает к таргету, если пас - отдаляет.
        """
        try:
            actor_id = _string_to_uuid(str(actor_user_id))
            target_id = _string_to_uuid(str(target_user_id))
            
            # ВАЖНО: Добавили with_payload=True
            points = self._qdrant_client.retrieve(
                collection_name="user_profiles",
                ids=[actor_id, target_id],
                with_vectors=True,
                with_payload=True 
            )
            
            if len(points) != 2:
                print(f"[{trace_id}] Не найдены векторы для юзеров {actor_user_id} и {target_user_id}")
                return
            
            actor_vector, target_vector, actor_payload = None, None, None
            for point in points:
                if point.id == actor_id:
                    actor_vector = point.vector
                    actor_payload = point.payload # ВАЖНО: Сохраняем payload
                elif point.id == target_id:
                    target_vector = point.vector
            
            if actor_vector is None or target_vector is None:
                return
            
            # ВАЖНО: Увеличили шаг, чтобы результат был заметен сразу!
            alpha = 0.1
            
            if action == "like":
                # Приближаем: складываем векторы с весом
                new_vector = [
                    actor + alpha * target
                    for actor, target in zip(actor_vector, target_vector)
                ]
                print_msg = f"[{trace_id}] Вектор обновлен! Юзер {actor_user_id} приблизился к {target_user_id} (like)"
            else:
                # Отдаляем: вычитаем, как было
                new_vector = [
                    actor - alpha * target
                    for actor, target in zip(actor_vector, target_vector)
                ]
                print_msg = f"[{trace_id}] Вектор обновлен! Юзер {actor_user_id} отдалился от {target_user_id} (pass)"
            
            # Нормализация
            norm = np.linalg.norm(new_vector)
            if norm > 0:
                new_vector = [float(x / norm) for x in new_vector] # Приводим к float для JSON
            
            # ВАЖНО: Передаем payload обратно
            self._qdrant_client.upsert(
                collection_name="user_profiles",
                points=[PointStruct(id=actor_id, vector=new_vector, payload=actor_payload)]
            )
            print(print_msg)
            
        except Exception as exc:
            print(f"[{trace_id}] Ошибка обновления вектора: {exc}")
    '''def update_user_profile_favorites(
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
'''
