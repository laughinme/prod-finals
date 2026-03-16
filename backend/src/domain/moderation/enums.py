from enum import Enum


class ModerationReportStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ModerationReviewAction(str, Enum):
    NONE = "none"
    BANNED = "banned"
