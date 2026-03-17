from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..mixins import CreatedAtMixin
from ..table_base import Base


class Block(CreatedAtMixin, Base):
    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint(
            "actor_user_id", "target_user_id", name="uq_blocks_actor_target"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), default=uuid4, primary_key=True
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    target_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    source_context: Mapped[str] = mapped_column(String(32), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(32), nullable=False)
    client_event_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )


class Report(CreatedAtMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint(
            "actor_user_id", "client_event_id", name="uq_reports_actor_client"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), default=uuid4, primary_key=True
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    target_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    source_context: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    related_message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    also_block: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    review_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )
    review_action: Mapped[str] = mapped_column(
        String(32), nullable=False, default="none"
    )
    reviewer_user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    client_event_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
