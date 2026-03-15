from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..mixins import CreatedAtMixin, TimestampMixin
from ..table_base import Base


class RecommendationBatch(TimestampMixin, Base):
    __tablename__ = "recommendation_batches"
    __table_args__ = (
        UniqueConstraint("user_id", "batch_date", name="uq_recommendation_batches_user_date"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    batch_date: Mapped[date] = mapped_column(Date, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    decision_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)


class RecommendationItem(CreatedAtMixin, Base):
    __tablename__ = "recommendation_items"
    __table_args__ = (
        UniqueConstraint("batch_id", "rank", name="uq_recommendation_items_batch_rank"),
        UniqueConstraint("batch_id", "target_user_id", name="uq_recommendation_items_batch_target"),
        Index("ix_recommendation_items_batch_id", "batch_id"),
        Index("ix_recommendation_items_target_user_id", "target_user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    batch_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("recommendation_batches.id", ondelete="CASCADE"))
    target_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    compatibility_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    preview: Mapped[str] = mapped_column(String(160), nullable=False)
    reason_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    details_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reaction_action: Mapped[str | None] = mapped_column(String(16), nullable=True)
