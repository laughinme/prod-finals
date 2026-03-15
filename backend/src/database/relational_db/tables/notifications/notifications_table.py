from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..mixins import CreatedAtMixin
from ..table_base import Base


class MatchNotification(CreatedAtMixin, Base):
    __tablename__ = "match_notifications"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    match_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"))
    conversation_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"),
    )
    peer_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    notification_type: Mapped[str] = mapped_column(String(32), nullable=False, default="match_created")
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_match_notifications_user_match"),
        Index("ix_match_notifications_user_seen_created", "user_id", "seen_at", "created_at"),
    )
