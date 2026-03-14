from enum import Enum


class PhotoModerationStatus(str, Enum):
    PENDING_MODERATION = "pending_moderation"
    APPROVED = "approved"
    REJECTED = "rejected"


class OnboardingStatus(str, Enum):
    PROFILE_INCOMPLETE = "profile_incomplete"
    PHOTO_REQUIRED = "photo_required"
    PHOTO_PENDING = "photo_pending"
    READY_FOR_FEED = "ready_for_feed"
    BLOCKED_FROM_FEED = "blocked_from_feed"


class ProfileStatus(str, Enum):
    ACTIVE = "active"
    RESTRICTED = "restricted"
    BLOCKED = "blocked"


class FeedDecisionMode(str, Enum):
    MODEL = "model"
    FALLBACK = "fallback"


class CompatibilityMode(str, Enum):
    MODEL = "model"
    BASIC_FALLBACK = "basic_fallback"


class CompatibilityReasonCode(str, Enum):
    LIFESTYLE_SIMILARITY = "lifestyle_similarity"
    ACTIVITY_OVERLAP = "activity_overlap"
    COMMUNICATION_STYLE_FIT = "communication_style_fit"
    MEETUP_RHYTHM_FIT = "meetup_rhythm_fit"
    LOCALITY_FIT = "locality_fit"


class FeedReactionAction(str, Enum):
    LIKE = "like"
    PASS = "pass"
    HIDE = "hide"


class FeedReactionResult(str, Enum):
    LIKED = "liked"
    PASSED = "passed"
    HIDDEN = "hidden"
    MATCHED = "matched"


class FutureFeedStatus(str, Enum):
    COOLDOWN = "cooldown"
    HIDDEN = "hidden"
    MATCHED = "matched"
    NONE = "none"


class FeedEmptyStateCode(str, Enum):
    NO_CANDIDATES_NOW = "no_candidates_now"
    DAILY_BATCH_EXHAUSTED = "daily_batch_exhausted"
    PHOTO_PENDING = "photo_pending"
    PROFILE_INCOMPLETE = "profile_incomplete"


class PairStateStatus(str, Enum):
    NONE = "none"
    ONE_WAY_LIKE = "one_way_like"
    MATCHED = "matched"
    CONVERSATION_ACTIVE = "conversation_active"
    CLOSED = "closed"
    BLOCKED = "blocked"
    HIDDEN = "hidden"


class MatchStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    BLOCKED = "blocked"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    BLOCKED = "blocked"


class MessageDeliveryStatus(str, Enum):
    SENT = "sent"


class MatchCloseReason(str, Enum):
    NO_INTEREST_AFTER_CHAT = "no_interest_after_chat"
    NOT_A_FIT = "not_a_fit"
    SAFETY_DISCOMFORT_OTHER = "safety_discomfort_other"


class SafetySourceContext(str, Enum):
    FEED = "feed"
    MATCH_LIST = "match_list"
    CONVERSATION = "conversation"
    SAFETY_SHEET = "safety_sheet"


class BlockReasonCode(str, Enum):
    UNWANTED_CONTACT = "unwanted_contact"
    SCAM_SUSPECTED = "scam_suspected"
    HARASSMENT = "harassment"
    OTHER = "other"


class ReportCategory(str, Enum):
    HARASSMENT = "harassment"
    FRAUD = "fraud"
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


class Goal(str, Enum):
    SERIOUS_RELATIONSHIP = "serious_relationship"
    DATING = "dating"
    FRIENDSHIP = "friendship"
