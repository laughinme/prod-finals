from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from domain.common import TimestampModel
from domain.users.enums import Gender

from .enums import (
    AuditEntityType,
    BlockReasonCode,
    CompatibilityMode,
    CompatibilityReasonCode,
    ConversationStatus,
    FeedDecisionMode,
    FeedEmptyStateCode,
    FeedReactionAction,
    FeedReactionResult,
    FutureFeedStatus,
    Goal,
    MatchCloseReason,
    MatchStatus,
    MessageDeliveryStatus,
    OnboardingStatus,
    PhotoModerationStatus,
    ProfileStatus,
    ReportCategory,
    SafetySourceContext,
)


class CityRef(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=128)


class AgeRange(BaseModel):
    min: int = Field(..., ge=18, le=99)
    max: int = Field(..., ge=18, le=99)

    @model_validator(mode="after")
    def validate_range(self):
        if self.min > self.max:
            raise ValueError("Age range min must be less than or equal to max")
        return self


class OnboardingStateResponse(BaseModel):
    user_id: UUID
    status: OnboardingStatus
    required_steps: list[str]
    missing_fields: list[str]
    has_min_profile: bool
    has_approved_photo: bool
    next_step: str


class OnboardingFinishResponse(BaseModel):
    status: OnboardingStatus
    feed_unlocked: bool


class CandidatePreview(BaseModel):
    user_id: UUID
    display_name: str
    age: int = Field(..., ge=18, le=99)
    city_name: str
    bio: str
    primary_photo_url: str
    photo_count: int = Field(..., ge=1, le=10)


class CompatibilityPreview(BaseModel):
    score: float = Field(..., ge=0, le=1)
    mode: CompatibilityMode
    preview: str = Field(..., max_length=160)
    reason_codes: list[CompatibilityReasonCode] = Field(..., min_length=1, max_length=5)
    details_available: bool


class FeedCardActions(BaseModel):
    can_like: bool
    can_pass: bool
    can_hide: bool
    can_block: bool
    can_report: bool


class FeedCard(BaseModel):
    serve_item_id: UUID
    candidate: CandidatePreview
    compatibility: CompatibilityPreview
    actions: FeedCardActions


class FeedEmptyState(BaseModel):
    code: FeedEmptyStateCode
    title: str
    message: str


class FeedResponse(BaseModel):
    batch_id: UUID
    generated_at: datetime
    expires_at: datetime
    daily_limit: int = Field(..., ge=1, le=20)
    remaining_today: int = Field(..., ge=0, le=20)
    decision_mode: FeedDecisionMode
    cards: list[FeedCard] = Field(default_factory=list, max_length=20)
    empty_state: FeedEmptyState | None = None


class CompatibilityReason(BaseModel):
    code: CompatibilityReasonCode
    title: str = Field(..., max_length=64)
    text: str = Field(..., max_length=240)
    confidence: float | None = Field(None, ge=0, le=1)


class CompatibilityExplanationResponse(BaseModel):
    serve_item_id: UUID
    candidate_user_id: UUID
    privacy_level: str = "safe_aggregate"
    mode: CompatibilityMode
    reasons: list[CompatibilityReason] = Field(..., min_length=1, max_length=5)


class FeedReactionRequest(BaseModel):
    action: FeedReactionAction
    client_event_id: UUID | None = None


class MatchLink(BaseModel):
    match_id: UUID
    conversation_id: UUID


class FeedReactionResponse(BaseModel):
    serve_item_id: UUID
    target_user_id: UUID
    action: FeedReactionAction
    result: FeedReactionResult
    future_feed_status: FutureFeedStatus
    cooldown_until: datetime | None = None
    match: MatchLink | None = None


class MatchListItem(BaseModel):
    match_id: UUID
    candidate_user_id: UUID
    display_name: str
    primary_photo_url: str
    conversation_id: UUID
    status: MatchStatus
    last_message_preview: str | None = None
    last_message_at: datetime | None = None


class MatchListResponse(BaseModel):
    items: list[MatchListItem] = Field(default_factory=list, max_length=500)


class CloseMatchRequest(BaseModel):
    reason_code: MatchCloseReason
    client_event_id: UUID | None = None


class CloseMatchResponse(BaseModel):
    match_id: UUID
    status: MatchStatus
    conversation_closed: bool
    future_feed_status: FutureFeedStatus
    cooldown_until: datetime | None


class ConversationPeer(BaseModel):
    user_id: UUID
    display_name: str
    primary_photo_url: str


class ConversationSafetyActions(BaseModel):
    can_block: bool
    can_report: bool


class ConversationResponse(BaseModel):
    conversation_id: UUID
    match_id: UUID
    status: ConversationStatus
    peer: ConversationPeer
    safety_actions: ConversationSafetyActions


class SendMessageRequest(BaseModel):
    client_message_id: UUID
    text: str = Field(..., min_length=1, max_length=4000)

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message text must not be empty")
        return stripped


class MessageResponse(BaseModel):
    message_id: UUID
    client_message_id: UUID
    sender_user_id: UUID
    text: str = Field(..., max_length=4000)
    created_at: datetime
    delivery_status: MessageDeliveryStatus


class ConversationMessagesResponse(BaseModel):
    items: list[MessageResponse] = Field(default_factory=list, max_length=100)
    next_cursor: str | None = None


class BlockRequest(BaseModel):
    target_user_id: UUID
    source_context: SafetySourceContext
    reason_code: BlockReasonCode
    client_event_id: UUID | None = None


class BlockResponse(BaseModel):
    target_user_id: UUID
    status: str = "blocked"
    conversation_closed: bool
    match_closed: bool
    removed_from_future_feed: bool


class ReportRequest(BaseModel):
    target_user_id: UUID
    source_context: SafetySourceContext
    category: ReportCategory
    description: str | None = Field(None, max_length=1000)
    related_message_id: str | None = None
    also_block: bool
    client_event_id: UUID | None = None


class ReportResponse(BaseModel):
    report_id: UUID
    status: str = "accepted"
    also_block_applied: bool


class AuditEvent(BaseModel):
    event_id: UUID
    event_type: str
    entity_type: AuditEntityType
    entity_id: str
    actor_user_id: UUID | None = None
    created_at: datetime
    payload: dict


class AuditEventsResponse(BaseModel):
    items: list[AuditEvent] = Field(default_factory=list, max_length=200)


class AuditEventsQuery(BaseModel):
    entity_type: AuditEntityType
    entity_id: str = Field(..., min_length=1)
    limit: int = Field(50, ge=1, le=200)


class MlReasonSignal(BaseModel):
    code: CompatibilityReasonCode
    strength: str
    confidence: float = Field(..., ge=0, le=1)


class MlCandidateScore(BaseModel):
    candidate_user_id: UUID
    score: float = Field(..., ge=0, le=1)
    reason_signals: list[MlReasonSignal] = Field(default_factory=list)


class FeedCandidateContext(BaseModel):
    user_id: UUID
    display_name: str
    birth_date: date
    city_id: str
    city_name: str
    bio: str | None = None
    gender: Gender | None = None
    looking_for_genders: list[Gender] = Field(default_factory=list)
    age_range: AgeRange | None = None
    distance_km: int | None = None
    goal: Goal | None = None
    avatar_url: str
    has_approved_photo: bool = True
    has_min_profile: bool = True


class MockRecommendationRequest(BaseModel):
    requester: FeedCandidateContext
    candidates: list[FeedCandidateContext]
    limit: int = Field(..., ge=1, le=20)


class MockRecommendationResponse(BaseModel):
    decision_mode: FeedDecisionMode = FeedDecisionMode.FALLBACK
    candidates: list[MlCandidateScore] = Field(default_factory=list)


class MockExplanationRequest(BaseModel):
    requester: FeedCandidateContext
    candidate: FeedCandidateContext
    max_reasons: int = Field(3, ge=1, le=5)


class UserDatingState(BaseModel):
    onboarding_status: OnboardingStatus
    has_min_profile: bool
    has_approved_photo: bool
    profile_status: ProfileStatus


class UserReadModel(TimestampModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str | None = None
    display_name: str | None = None
    avatar_key: str | None = None
    avatar_url: str | None = None
    avatar_status: PhotoModerationStatus | None = None
    avatar_rejection_reason: str | None = None
    birth_date: date | None = None
    bio: str | None = None
    city: CityRef | None = None
    gender: Gender | None = None
    looking_for_genders: list[Gender] = Field(default_factory=list)
    age_range: AgeRange | None = None
    distance_km: int | None = None
    goal: Goal | None = None
    is_onboarded: bool
    onboarding_status: OnboardingStatus
    has_min_profile: bool
    has_approved_photo: bool
    profile_status: ProfileStatus
    banned: bool
    role_slugs: list[str] = Field(default_factory=list)
