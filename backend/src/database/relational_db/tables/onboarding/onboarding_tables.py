from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..mixins import TimestampMixin
from ..table_base import Base


class OnboardingQuizAnswer(TimestampMixin, Base):
    __tablename__ = "onboarding_quiz_answers"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "step_key", name="uq_onboarding_quiz_answers_user_step"
        ),
        Index("ix_onboarding_quiz_answers_user_id", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), default=uuid4, primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    step_key: Mapped[str] = mapped_column(String(64), nullable=False)
    answers: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
