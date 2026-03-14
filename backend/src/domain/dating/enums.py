from enum import Enum


class AvatarModerationStatus(str, Enum):
    MISSING = "missing"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class QuizStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SKIPPED = "skipped"
    COMPLETED = "completed"


class ProfileStatus(str, Enum):
    DRAFT = "draft"
    REQUIRED_FIELDS_MISSING = "required_fields_missing"
    AVATAR_REQUIRED = "avatar_required"
    AVATAR_PENDING = "avatar_pending"
    READY = "ready"
    BLOCKED = "blocked"


class FeedState(str, Enum):
    LOCKED = "locked"
    READY = "ready"
    EXHAUSTED = "exhausted"
    DEGRADED = "degraded"


class FeedLockReason(str, Enum):
    AVATAR_REQUIRED = "avatar_required"
    AVATAR_PENDING = "avatar_pending"
    REQUIRED_FIELDS_MISSING = "required_fields_missing"
    BLOCKED = "blocked"


class DecisionMode(str, Enum):
    MODEL = "model"
    FALLBACK = "fallback"


class NextActionType(str, Enum):
    UPLOAD_AVATAR = "upload_avatar"
    COMPLETE_REQUIRED_FIELDS = "complete_required_fields"
    START_QUIZ = "start_quiz"
    RESUME_QUIZ = "resume_quiz"
    OPEN_FEED = "open_feed"
    WAIT_FOR_MODERATION = "wait_for_moderation"


class OnboardingStepType(str, Enum):
    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"
    RANGE = "range"


class FeedEmptyStateCode(str, Enum):
    NO_MORE_CANDIDATES_TODAY = "no_more_candidates_today"
    CANDIDATE_POOL_LOW = "candidate_pool_low"
    SAFETY_FILTERED_ALL = "safety_filtered_all"
    TRY_AGAIN_TOMORROW = "try_again_tomorrow"


class FeedAction(str, Enum):
    LIKE = "like"
    PASS = "pass"
    HIDE = "hide"


class FeedReactionResult(str, Enum):
    LIKED = "liked"
    PASSED = "passed"
    HIDDEN = "hidden"
    MATCHED = "matched"


class Goal(str, Enum):
    SERIOUS_RELATIONSHIP = "serious_relationship"
    NEW_FRIENDS = "new_friends"
    CASUAL_DATES = "casual_dates"


class CompatibilityReasonCode(str, Enum):
    CITY_FIT = "city_fit"
    AGE_FIT = "age_fit"
    GOAL_FIT = "goal_fit"
    MUTUAL_PREFERENCE_FIT = "mutual_preference_fit"
    PROFILE_QUALITY = "profile_quality"


class MatchStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    BLOCKED = "blocked"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    CLOSED_BY_USER = "closed_by_user"
    CLOSED_BY_BLOCK = "closed_by_block"
    CLOSED_BY_REPORT = "closed_by_report"


class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class CloseMatchReasonCode(str, Enum):
    NOT_INTERESTED = "not_interested"
    CONVERSATION_FINISHED = "conversation_finished"
    OTHER = "other"


class SafetySourceContext(str, Enum):
    FEED = "feed"
    MATCH_LIST = "match_list"
    CONVERSATION = "conversation"
    PROFILE = "profile"


class BlockReasonCode(str, Enum):
    UNWANTED_CONTACT = "unwanted_contact"
    HARASSMENT = "harassment"
    SPAM = "spam"
    OTHER = "other"


class ReportCategory(str, Enum):
    HARASSMENT = "harassment"
    SPAM = "spam"
    FAKE_PROFILE = "fake_profile"
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    OTHER = "other"


class AuditEntityType(str, Enum):
    USER = "user"
    FEED_ITEM = "feed_item"
    PAIR = "pair"
    MATCH = "match"
    CONVERSATION = "conversation"
    BLOCK = "block"
    REPORT = "report"
    QUIZ = "quiz"

