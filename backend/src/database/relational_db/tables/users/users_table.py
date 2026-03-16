from typing import TYPE_CHECKING
from urllib.parse import quote
from uuid import UUID, uuid4
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.config import get_settings
from domain.dating.enums import AvatarModerationStatus, ProfileStatus
from ..table_base import Base
from ..mixins import TimestampMixin

if TYPE_CHECKING:
    from ..cities import City
    from ..roles import Role


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), default=uuid4, primary_key=True)
    service_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    is_dataset_user: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    
    # Credentials
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Minimal profile for template
    first_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
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
    interests: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    quiz_started: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    quiz_current_step_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    onboarding_skipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    demo_user_key: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)

    # Service
    is_onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    banned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auth_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )

    __table_args__ = (
        # GIN trigram indexes for fast text search
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
        full_name = " ".join(
            part.strip()
            for part in (self.first_name, self.last_name)
            if part and part.strip()
        ).strip()
        return full_name or None

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
    def age(self) -> int | None:
        if self.birth_date is None:
            return None
        today = date.today()
        years = today.year - self.birth_date.year
        if (today.month, today.day) < (self.birth_date.month, self.birth_date.day):
            years -= 1
        return years

    @property
    def avatar_moderation_status(self) -> str:
        if not self.avatar_key:
            return AvatarModerationStatus.MISSING.value
        if self.avatar_status == AvatarModerationStatus.REJECTED.value:
            return AvatarModerationStatus.REJECTED.value
        if self.avatar_status == AvatarModerationStatus.PENDING.value:
            return AvatarModerationStatus.PENDING.value
        if self.avatar_status == AvatarModerationStatus.APPROVED.value:
            return AvatarModerationStatus.APPROVED.value
        return AvatarModerationStatus.MISSING.value

    @property
    def missing_required_fields(self) -> list[str]:
        missing: list[str] = []
        if not (self.first_name and self.first_name.strip()):
            missing.append("first_name")
        if self.birth_date is None:
            missing.append("birth_date")
        if self.gender is None:
            missing.append("gender")
        if not self.has_approved_photo:
            missing.append("avatar")
        return missing

    @property
    def has_min_profile(self) -> bool:
        return not any(
            field in {"first_name", "birth_date", "gender"}
            for field in self.missing_required_fields
        )

    @property
    def has_approved_photo(self) -> bool:
        return bool(self.avatar_key and self.avatar_moderation_status == AvatarModerationStatus.APPROVED.value)

    @property
    def profile_status(self) -> str:
        if self.banned:
            return ProfileStatus.BLOCKED.value
        if not self.has_min_profile:
            return ProfileStatus.REQUIRED_FIELDS_MISSING.value
        if self.avatar_moderation_status == AvatarModerationStatus.PENDING.value:
            return ProfileStatus.AVATAR_PENDING.value
        if self.avatar_moderation_status in {
            AvatarModerationStatus.MISSING.value,
            AvatarModerationStatus.REJECTED.value,
        }:
            return ProfileStatus.AVATAR_REQUIRED.value
        return ProfileStatus.READY.value

    @property
    def can_open_feed(self) -> bool:
        return self.profile_status == ProfileStatus.READY.value

    @property
    def profile_completion_percent(self) -> int:
        checks = [
            bool(self.resolved_display_name),
            self.birth_date is not None,
            self.gender is not None,
            bool(self.looking_for_genders),
            self.age_range_min is not None and self.age_range_max is not None,
            self.bio is not None and bool(self.bio.strip()),
            bool(self.interests),
            self.has_approved_photo,
        ]
        completed = sum(1 for item in checks if item)
        return int(round(completed / len(checks) * 100))

    @property
    def onboarding_status(self) -> str:
        if self.banned:
            return "blocked_from_feed"
        if not self.has_min_profile:
            return "profile_required"
        if self.profile_status == ProfileStatus.AVATAR_PENDING.value:
            return "photo_pending"
        if self.profile_status == ProfileStatus.AVATAR_REQUIRED.value:
            return "photo_required"
        return "ready_for_feed"

    @property
    def required_profile_step_key(self) -> str | None:
        missing = set(self.missing_required_fields)
        if "avatar" in missing:
            return "photo_upload"
        if missing:
            return "profile_basics"
        return None

    def has_roles(self, *slugs: str) -> bool:
        if not slugs:
            return True
        owned = set(self.role_slugs)
        return all(slug in owned for slug in slugs)

    def bump_auth_version(self) -> None:
        self.auth_version = (self.auth_version or 0) + 1
