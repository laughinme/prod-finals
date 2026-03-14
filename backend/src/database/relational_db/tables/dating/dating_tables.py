from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
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
    daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=12)


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


class InteractionEvent(CreatedAtMixin, Base):
    __tablename__ = "interaction_events"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "serve_item_id", name="uq_interaction_events_actor_serve_item"),
        Index("ix_interaction_events_actor_target", "actor_user_id", "target_user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    actor_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    target_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    serve_item_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("recommendation_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    source_context: Mapped[str] = mapped_column(String(32), nullable=False, default="feed")
    client_event_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


class OnboardingQuizAnswer(TimestampMixin, Base):
    __tablename__ = "onboarding_quiz_answers"
    __table_args__ = (
        UniqueConstraint("user_id", "step_key", name="uq_onboarding_quiz_answers_user_step"),
        Index("ix_onboarding_quiz_answers_user_id", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    step_key: Mapped[str] = mapped_column(String(64), nullable=False)
    answers: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class PairState(TimestampMixin, Base):
    __tablename__ = "pair_states"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_pair_states_pair"),
        Index("ix_pair_states_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    user_low_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    user_high_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    low_action: Mapped[str | None] = mapped_column(String(16), nullable=True)
    high_action: Mapped[str | None] = mapped_column(String(16), nullable=True)
    low_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    high_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    cooldown_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    blocked_by_user_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    hidden_by_user_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    match_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    conversation_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


class Match(TimestampMixin, Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_matches_pair"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    user_low_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    user_high_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    conversation_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    close_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    match_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Message(CreatedAtMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "client_message_id", name="uq_messages_conversation_client"),
        Index("ix_messages_conversation_created_at", "conversation_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    conversation_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    client_message_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)


class Block(CreatedAtMixin, Base):
    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "target_user_id", name="uq_blocks_actor_target"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    actor_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    target_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    source_context: Mapped[str] = mapped_column(String(32), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(32), nullable=False)
    client_event_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


class Report(CreatedAtMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "client_event_id", name="uq_reports_actor_client"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    actor_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    target_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    source_context: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    related_message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    also_block: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    client_event_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


class AuditLog(CreatedAtMixin, Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_entity", "entity_type", "entity_id"),
        Index("ix_audit_log_actor", "actor_user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class OutboxEvent(TimestampMixin, Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        Index("ix_outbox_events_status_available_at", "status", "available_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    topic: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    available_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
