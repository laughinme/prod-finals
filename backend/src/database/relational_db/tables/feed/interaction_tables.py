from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..mixins import CreatedAtMixin
from ..table_base import Base


class InteractionEvent(CreatedAtMixin, Base):
    __tablename__ = "interaction_events"
    __table_args__ = (
        UniqueConstraint(
            "actor_user_id",
            "serve_item_id",
            name="uq_interaction_events_actor_serve_item",
        ),
        Index("ix_interaction_events_actor_target", "actor_user_id", "target_user_id"),
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
    serve_item_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("recommendation_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    source_context: Mapped[str] = mapped_column(
        String(32), nullable=False, default="feed"
    )
    client_event_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
