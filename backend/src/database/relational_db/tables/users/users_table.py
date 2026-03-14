from typing import TYPE_CHECKING
from urllib.parse import quote
from uuid import UUID, uuid4
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.config import get_settings
from domain.dating.enums import OnboardingStatus, PhotoModerationStatus, ProfileStatus
from ..table_base import Base
from ..mixins import TimestampMixin

if TYPE_CHECKING:
    from ..cities import City
    from ..roles import Role


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    
    # Credentials
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Minimal profile for template
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    avatar_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    avatar_rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("cities.id", ondelete="SET NULL"),
        nullable=True,
    )
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    looking_for_genders: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    age_range_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_range_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal: Mapped[str | None] = mapped_column(String(32), nullable=True)
    
    # Service
    is_onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    banned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auth_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )

    __table_args__ = (
        # GIN trigram indexes for fast text search
        Index(
            'users_username_trgm',
            'username',
            postgresql_using='gin',
            postgresql_ops={'username': 'gin_trgm_ops'}
        ),
        Index(
            'users_email_trgm',
            'email',
            postgresql_using='gin',
            postgresql_ops={'email': 'gin_trgm_ops'}
        ),
    )
    
    roles: Mapped[list["Role"]] = relationship(  # pyright: ignore
        "Role",
        secondary="user_roles",
        back_populates="users",
        lazy="selectin",
    )
    city: Mapped["City | None"] = relationship("City", lazy="selectin")
    
    @property
    def role_slugs(self) -> list[str]:
        return [role.slug for role in self.roles]

    @property
    def resolved_display_name(self) -> str | None:
        return self.display_name or self.username

    @property
    def avatar_url(self) -> str | None:
        if not self.avatar_key:
            return None

        settings = get_settings()
        encoded_key = quote(self.avatar_key, safe="/")
        return f"{settings.STORAGE_ENDPOINT_PUBLIC}/{settings.STORAGE_PUBLIC_BUCKET}/{encoded_key}"

    @property
    def age_range(self) -> dict[str, int] | None:
        if self.age_range_min is None or self.age_range_max is None:
            return None
        return {"min": self.age_range_min, "max": self.age_range_max}

    @property
    def has_min_profile(self) -> bool:
        return bool(
            (self.display_name or self.username)
            and self.birth_date
            and self.city_id
            and self.gender
            and self.looking_for_genders
            and self.age_range_min is not None
            and self.age_range_max is not None
            and self.goal
        )

    @property
    def has_approved_photo(self) -> bool:
        return bool(self.avatar_key and self.avatar_status == PhotoModerationStatus.APPROVED.value)

    @property
    def onboarding_status(self) -> str:
        if self.banned:
            return OnboardingStatus.BLOCKED_FROM_FEED.value
        if not self.has_min_profile:
            return OnboardingStatus.PROFILE_INCOMPLETE.value
        if not self.avatar_key:
            return OnboardingStatus.PHOTO_REQUIRED.value
        if self.avatar_status == PhotoModerationStatus.PENDING_MODERATION.value:
            return OnboardingStatus.PHOTO_PENDING.value
        if not self.has_approved_photo:
            return OnboardingStatus.PHOTO_REQUIRED.value
        return OnboardingStatus.READY_FOR_FEED.value

    @property
    def profile_status(self) -> str:
        if self.banned:
            return ProfileStatus.BLOCKED.value
        if self.onboarding_status == OnboardingStatus.READY_FOR_FEED.value:
            return ProfileStatus.ACTIVE.value
        return ProfileStatus.RESTRICTED.value

    def has_roles(self, *slugs: str) -> bool:
        if not slugs:
            return True
        owned = set(self.role_slugs)
        return all(slug in owned for slug in slugs)

    def bump_auth_version(self) -> None:
        self.auth_version = (self.auth_version or 0) + 1
