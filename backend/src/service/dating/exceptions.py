from core.errors import BadRequestError, ConflictError, NotFoundError, UnprocessableEntityError


class OnboardingNotReadyError(ConflictError):
    error_code = "ONBOARDING_NOT_READY"
    default_detail = "Onboarding is not ready to finish"


class FeedLockedError(ConflictError):
    error_code = "FEED_LOCKED"
    default_detail = "Feed is locked until onboarding is complete"


class FeedItemNotFoundError(NotFoundError):
    error_code = "FEED_ITEM_NOT_FOUND"
    default_detail = "Feed item not found"


class FeedItemAlreadyProcessedError(ConflictError):
    error_code = "FEED_ITEM_ALREADY_PROCESSED"
    default_detail = "Feed item already processed"


class MatchNotFoundError(NotFoundError):
    error_code = "MATCH_NOT_FOUND"
    default_detail = "Match not found"


class InvalidMatchStateError(ConflictError):
    error_code = "INVALID_MATCH_STATE"
    default_detail = "Invalid match state transition"


class ConversationNotFoundError(NotFoundError):
    error_code = "CONVERSATION_NOT_FOUND"
    default_detail = "Conversation not found"


class ConversationUnavailableError(ConflictError):
    error_code = "CONVERSATION_UNAVAILABLE"
    default_detail = "Conversation is unavailable"


class AlreadyBlockedError(ConflictError):
    error_code = "ALREADY_BLOCKED"
    default_detail = "User is already blocked"


class InvalidSafetyTargetError(BadRequestError):
    error_code = "INVALID_SAFETY_TARGET"
    default_detail = "Cannot perform safety action for this target"


class MessageValidationError(UnprocessableEntityError):
    error_code = "MESSAGE_VALIDATION_ERROR"
    default_detail = "Message failed validation"
