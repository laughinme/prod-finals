from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from domain.dating.enums import ReportCategory, SafetySourceContext
from domain.moderation.enums import ModerationReportStatus, ModerationReviewAction


class ModerationUserRef(BaseModel):
    id: UUID
    email: str
    display_name: str
    avatar_url: str | None = None
    banned: bool = False


class ModerationReportItem(BaseModel):
    id: UUID
    created_at: datetime
    source_context: SafetySourceContext
    category: ReportCategory
    description: str | None = None
    related_message_id: str | None = None
    also_block: bool = False
    review_status: ModerationReportStatus
    review_action: ModerationReviewAction
    reviewed_at: datetime | None = None
    review_note: str | None = None
    actor: ModerationUserRef
    target: ModerationUserRef
    reviewer: ModerationUserRef | None = None


class ModerationReportListResponse(BaseModel):
    items: list[ModerationReportItem] = Field(default_factory=list)


class ModerationReportSummary(BaseModel):
    total_reports: int = Field(default=0, ge=0)
    pending_reports: int = Field(default=0, ge=0)
    resolved_reports: int = Field(default=0, ge=0)
    dismissed_reports: int = Field(default=0, ge=0)
    banned_targets: int = Field(default=0, ge=0)


class ModerationReviewRequest(BaseModel):
    status: ModerationReportStatus
    review_note: str | None = Field(default=None, max_length=1000)
    ban_user: bool = False


class ModerationReviewResponse(BaseModel):
    report: ModerationReportItem
