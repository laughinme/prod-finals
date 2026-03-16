from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from domain.users.enums import Gender

from .enums import (
    AuditEntityType,
    AvatarModerationStatus,
    BlockReasonCode,
    CloseMatchReasonCode,
    CompatibilityReasonCode,
    ConversationStatus,
    DecisionMode,
    FeedAction,
    FeedEmptyStateCode,
    FeedLockReason,
    FeedReactionResult,
    FeedState,
    Goal,
    MatchStatus,
    MessageStatus,
    OnboardingStepType,
    ProfileStatus,
    ReportCategory,
    SafetySourceContext,
)


class AgeRange(BaseModel):
    min: int = Field(..., ge=18, le=99)
    max: int = Field(..., ge=18, le=99)

    @model_validator(mode="after")
    def validate_range(self):
        if self.min > self.max:
            raise ValueError("Age range min must be less than or equal to max")
        return self


class SearchPreferences(BaseModel):
    looking_for_genders: list[Gender] | None = None
    age_range: AgeRange | None = None
    distance_km: int | None = Field(default=None, ge=1, le=300)
    goal: Goal | None = None


class AvatarResponse(BaseModel):
    avatar_url: str | None = None
    status: AvatarModerationStatus
    uploaded_at: datetime | None = None
    moderation_reason: str | None = None


class OnboardingStepOption(BaseModel):
    value: str
    label: str
    weight: float | None = None


class OnboardingStep(BaseModel):
    step_key: str
    title: str
    subtitle: str | None = None
    description: str | None = None
    step_type: OnboardingStepType
    optional: bool = True
    multi_select: bool = False
    required_for_feed: bool = False
    min_answers: int | None = None
    max_answers: int | None = None
    range_min: int | None = None
    range_max: int | None = None
    range_min_label: str | None = None
    range_max_label: str | None = None
    import_transactions_enabled: bool = False
    import_transactions_default: bool = True
    import_transactions_value: bool | None = None
    options: list[OnboardingStepOption] = Field(default_factory=list)


class OnboardingConfigResponse(BaseModel):
    steps: list[OnboardingStep] = Field(default_factory=list)


class OnboardingProgress(BaseModel):
    quiz_started: bool = False
    skipped: bool = False
    completed: bool = False
    should_show: bool = True
    current_step_key: str | None = None
    required_profile_step_key: str | None = None
    missing_required_fields: list[str] = Field(default_factory=list)
    completed_step_keys: list[str] = Field(default_factory=list)
    answers_by_step: dict[str, list[str]] = Field(default_factory=dict)


class OnboardingStateResponse(OnboardingProgress):
    pass


class OnboardingAnswersRequest(BaseModel):
    step_key: str
    answers: list[str] = Field(default_factory=list)
    import_transactions: bool | None = None


class OnboardingAnswersResponse(OnboardingProgress):
    step_key: str
    saved: bool = True


class OnboardingEstimateRequest(BaseModel):
    answers_by_step: dict[str, list[str]] = Field(default_factory=dict)
    import_transactions: bool | None = None


class OnboardingEstimateResponse(BaseModel):
    estimated_count: int = Field(default=0, ge=0)


class FeedCandidate(BaseModel):
    user_id: UUID
    display_name: str
    age: int | None = None
    city: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


class CompatibilityCategoryScore(BaseModel):
    category_key: str
    label: str
    score_percent: int = Field(..., ge=0, le=100)


class CompatibilityReasonSignal(BaseModel):
    code: str
    label: str
    strength: str
    confidence: float = Field(..., ge=0, le=1)


class CompatibilityPreview(BaseModel):
    score: float = Field(..., ge=0, le=1)
    score_percent: int = Field(..., ge=0, le=100)
    preview: str
    reason_codes: list[str] = Field(default_factory=list)
    reason_signals: list[CompatibilityReasonSignal] = Field(default_factory=list)
    category_breakdown: list[CompatibilityCategoryScore] = Field(default_factory=list)


class FeedCardActions(BaseModel):
    can_like: bool
    can_pass: bool
    can_hide: bool
    can_block: bool
    can_report: bool


class FeedCard(BaseModel):
    serve_item_id: UUID
    candidate: FeedCandidate
    compatibility: CompatibilityPreview
    actions: FeedCardActions


class DemoFeedShortcutItem(BaseModel):
    demo_user_key: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    is_current_user: bool = False


class DemoFeedShortcutListResponse(BaseModel):
    items: list[DemoFeedShortcutItem] = Field(default_factory=list)


class FeedEmptyState(BaseModel):
    code: FeedEmptyStateCode
    title: str
    description: str | None = None


class FeedResponse(BaseModel):
    feed_state: FeedState
    profile_status: ProfileStatus
    batch_id: UUID | None = None
    generated_at: datetime | None = None
    expires_at: datetime | None = None
    lock_reason: FeedLockReason | None = None
    cards: list[FeedCard] = Field(default_factory=list)
    empty_state: FeedEmptyState | None = None
    warnings: list[str] = Field(default_factory=list)


class CompatibilityReason(BaseModel):
    code: str
    title: str
    text: str
    confidence: float = Field(..., ge=0, le=1)


class CompatibilityExplanationResponse(BaseModel):
    serve_item_id: UUID
    candidate_user_id: UUID
    privacy_level: str = "safe_aggregate"
    reasons: list[CompatibilityReason] = Field(default_factory=list)
    disclaimer: str | None = None


class MatchLink(BaseModel):
    match_id: UUID
    conversation_id: UUID


class FeedReactionRequest(BaseModel):
    action: FeedAction
    opened_explanation: bool = False
    opened_profile: bool = False
    dwell_time_ms: int | None = Field(default=None, ge=0)


class FeedReactionResponse(BaseModel):
    result: FeedReactionResult
    match: MatchLink | None = None
    next_card_hint: str | None = None


class FeedTestMatchResponse(BaseModel):
    status: str = "armed"
    message: str


class MatchListItem(BaseModel):
    match_id: UUID
    candidate_user_id: UUID
    display_name: str
    avatar_url: str | None = None
    conversation_id: UUID | None = None
    status: MatchStatus
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = Field(default=0, ge=0)


class MatchListResponse(BaseModel):
    items: list[MatchListItem] = Field(default_factory=list)


class CloseMatchRequest(BaseModel):
    reason_code: CloseMatchReasonCode


class CloseMatchResponse(BaseModel):
    status: str = "closed"
    removed_from_future_feed: bool


class ConversationPeer(BaseModel):
    user_id: UUID
    display_name: str
    avatar_url: str | None = None


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
    text: str = Field(..., min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message text must not be empty")
        return stripped


class MessageResponse(BaseModel):
    message_id: UUID
    sender_user_id: UUID
    text: str
    created_at: datetime
    status: MessageStatus


class ConversationMessagesResponse(BaseModel):
    items: list[MessageResponse] = Field(default_factory=list)
    next_cursor: str | None = None


class Icebreaker(BaseModel):
    icebreaker_id: str
    text: str
    reason: str | None = None


class IcebreakersResponse(BaseModel):
    items: list[Icebreaker] = Field(default_factory=list)


class BlockRequest(BaseModel):
    target_user_id: UUID
    source_context: SafetySourceContext
    reason_code: BlockReasonCode


class BlockResponse(BaseModel):
    status: str = "blocked"
    removed_from_future_feed: bool
    conversation_closed: bool | None = None
    match_closed: bool | None = None


class ReportRequest(BaseModel):
    target_user_id: UUID
    source_context: SafetySourceContext
    category: ReportCategory
    description: str | None = Field(default=None, max_length=1000)
    related_message_id: UUID | None = None
    also_block: bool = False


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
    items: list[AuditEvent] = Field(default_factory=list)


class AuditEventsQuery(BaseModel):
    entity_type: str | None = None
    entity_id: str | None = None
    limit: int = Field(default=50, ge=1, le=200)


class FeedCandidateContext(BaseModel):
    user_id: UUID
    ml_user_id: str | None = None
    display_name: str
    birth_date: date | None = None
    city: str | None = None
    gender: Gender | None = None
    search_preferences: SearchPreferences = Field(default_factory=SearchPreferences)
    interests: list[str] = Field(default_factory=list)
    bio: str | None = None
    avatar_url: str | None = None
    profile_completion_percent: int = Field(default=0, ge=0, le=100)


class RankedCandidate(BaseModel):
    candidate_user_id: UUID
    score: float = Field(..., ge=0, le=1)
    reason_codes: list[CompatibilityReasonCode] = Field(default_factory=list)
    reason_signals: list[CompatibilityReasonSignal] = Field(default_factory=list)
    category_keys: list[str] = Field(default_factory=list)
    category_scores: list[CompatibilityCategoryScore] = Field(default_factory=list)


class RankedCandidates(BaseModel):
    decision_mode: DecisionMode = DecisionMode.FALLBACK
    candidates: list[RankedCandidate] = Field(default_factory=list)


class ExplanationRequest(BaseModel):
    requester: FeedCandidateContext
    candidate: FeedCandidateContext
    serve_item_id: UUID


class IcebreakerRequest(BaseModel):
    requester: FeedCandidateContext
    candidate: FeedCandidateContext


class UserViewContext(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None = None
    display_name: str
    birth_date: date | None = None
    age: int | None = None
    city: str | None = None
    gender: Gender | None = None
    bio: str | None = None
    profile_status: ProfileStatus
    search_preferences: SearchPreferences
    avatar: AvatarResponse
    profile_completion_percent: int = Field(..., ge=0, le=100)
    can_open_feed: bool
