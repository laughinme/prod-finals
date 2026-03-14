from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MlStatus(str, Enum):
    ok = "ok"
    degraded = "degraded"
    down = "down"


class HealthDecisionMode(str, Enum):
    model = "model"
    fallback_only = "fallback_only"


class RecommendationDecisionMode(str, Enum):
    model = "model"
    fallback = "fallback"


class Strategy(str, Enum):
    balanced = "balanced"
    high_precision = "high_precision"
    exploration = "exploration"


class ClientType(str, Enum):
    ios = "ios"
    android = "android"
    web = "web"


class DecisionPolicy(str, Enum):
    daily_batch = "daily_batch"


class Strength(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ReasonCode(str, Enum):
    lifestyle_similarity = "lifestyle_similarity"
    activity_overlap = "activity_overlap"
    communication_style_fit = "communication_style_fit"
    meetup_rhythm_fit = "meetup_rhythm_fit"
    locality_fit = "locality_fit"
    novelty_boost = "novelty_boost"


class ExplanationReasonCode(str, Enum):
    lifestyle_similarity = "lifestyle_similarity"
    activity_overlap = "activity_overlap"
    communication_style_fit = "communication_style_fit"
    meetup_rhythm_fit = "meetup_rhythm_fit"
    locality_fit = "locality_fit"


class PolicyFlag(str, Enum):
    cooldown_candidate = "cooldown_candidate"
    low_profile_quality = "low_profile_quality"
    sparse_behavioral_data = "sparse_behavioral_data"


class SwipeAction(str, Enum):
    like = "like"
    passed = "pass"
    hide = "hide"
    block = "block"
    report = "report"


class SwipeSourceContext(str, Enum):
    feed = "feed"
    conversation = "conversation"
    match_list = "match_list"
    safety_sheet = "safety_sheet"


class MatchOutcome(str, Enum):
    match_created = "match_created"
    first_message_sent = "first_message_sent"
    mutual_conversation_started = "mutual_conversation_started"
    first_reply_within_24h = "first_reply_within_24h"
    conversation_closed = "conversation_closed"
    block_after_match = "block_after_match"
    report_after_match = "report_after_match"


class ExplanationChannel(str, Enum):
    feed = "feed"
    match = "match"
    conversation = "conversation"


class PrivacyLevel(str, Enum):
    safe_aggregate = "safe_aggregate"


class AckStatus(str, Enum):
    accepted = "accepted"


class MlChecks(StrictModel):
    ranker_loaded: bool
    explainer_loaded: bool
    feedback_ingest: bool


class MlHealthResponse(StrictModel):
    status: MlStatus
    timestamp: datetime
    decision_mode: HealthDecisionMode
    model_version: str
    features_version: str
    checks: MlChecks
    warnings: list[str] = Field(default_factory=list, max_length=20)


class HardFilters(StrictModel):
    age_min: int | None = Field(default=None, ge=18, le=99)
    age_max: int | None = Field(default=None, ge=18, le=99)
    city_id: str | None = None
    distance_km: int | None = Field(default=None, ge=1, le=300)
    genders: list[str] | None = Field(default=None, max_length=5)


class ExclusionSet(StrictModel):
    hard_exclude_user_ids: list[int] | None = Field(default=None, max_length=20000)
    soft_seen_user_ids: list[int] | None = Field(default=None, max_length=20000)


class RecommendationContext(StrictModel):
    request_ts: datetime
    session_id: str | None = None
    locale: str | None = None
    timezone: str | None = None
    client: ClientType
    decision_policy: DecisionPolicy


class RecommendationRequest(StrictModel):
    trace_id: UUID
    request_user_id: int
    limit: int = Field(default=12, ge=1, le=50)
    strategy: Strategy = Strategy.balanced
    hard_filters: HardFilters | None = None
    exclusion: ExclusionSet | None = None
    context: RecommendationContext


class ReasonSignal(StrictModel):
    code: ReasonCode
    strength: Strength
    confidence: float | None = Field(default=None, ge=0, le=1)


class RecommendationCandidate(StrictModel):
    candidate_user_id: int
    score: float = Field(ge=0, le=1)
    score_components: dict[str, float] | None = None
    reason_signals: list[ReasonSignal] = Field(min_length=1, max_length=5)
    policy_flags: list[PolicyFlag] = Field(default_factory=list, max_length=10)


class RecommendationResponse(StrictModel):
    trace_id: UUID
    generated_at: datetime
    model_version: str
    features_version: str
    decision_mode: RecommendationDecisionMode
    warnings: list[str] = Field(default_factory=list, max_length=20)
    candidates: list[RecommendationCandidate] = Field(default_factory=list, max_length=50)


class SwipeFeedbackRequest(StrictModel):
    trace_id: UUID
    event_id: UUID
    actor_user_id: int
    target_user_id: int
    action: SwipeAction
    shown_rank: int | None = Field(default=None, ge=1, le=100)
    shown_score: float | None = Field(default=None, ge=0, le=1)
    shown_at: datetime | None = None
    acted_at: datetime
    source_context: SwipeSourceContext = SwipeSourceContext.feed


class MatchOutcomeRequest(StrictModel):
    trace_id: UUID
    event_id: UUID
    match_id: UUID
    user_a_id: int
    user_b_id: int
    outcome: MatchOutcome
    happened_at: datetime


class CompatibilityExplanationRequest(StrictModel):
    trace_id: UUID
    requester_user_id: int
    candidate_user_id: int
    channel: ExplanationChannel = ExplanationChannel.feed
    locale: str = "ru-RU"
    max_reasons: int = Field(default=3, ge=1, le=5)


class ExplanationReason(StrictModel):
    code: ExplanationReasonCode
    template_key: str
    strength: Strength
    confidence: float | None = Field(default=None, ge=0, le=1)


class CompatibilityExplanationResponse(StrictModel):
    trace_id: UUID
    candidate_user_id: int
    privacy_level: PrivacyLevel
    reasons: list[ExplanationReason] = Field(min_length=1, max_length=5)
    privacy_checks: list[str] = Field(default_factory=list, max_length=10)


class AckResponse(StrictModel):
    status: AckStatus
    received_at: datetime


class ErrorResponse(StrictModel):
    error_code: str
    message: str
    details: dict[str, Any] | None = None
    trace_id: UUID
