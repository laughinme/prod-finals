from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Index, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..mixins import TimestampMixin
from ..table_base import Base


class AnalyticsDailyFunnel(TimestampMixin, Base):
    __tablename__ = "analytics_daily_funnel"
    __table_args__ = (
        UniqueConstraint(
            "day",
            "user_source",
            "decision_mode",
            name="uq_analytics_daily_funnel_segment",
        ),
        Index("ix_analytics_daily_funnel_day", "day"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), default=uuid4, primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    user_source: Mapped[str] = mapped_column(String(32), nullable=False)
    decision_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    feed_served: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feed_explanation_opened: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    feed_like: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feed_pass: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feed_hide: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    match_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chat_first_message_sent: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    chat_first_reply_received: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    match_closed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    user_blocked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    user_reported: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
