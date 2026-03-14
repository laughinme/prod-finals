from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from domain.dating import (
    AvatarResponse,
    SearchPreferences,
    LifestyleTag,
    ProfileStatus,
    QuizStatus,
    RecommendationMode,
)
from domain.users.enums import Gender


class UserModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None = None
    display_name: str
    birth_date: date | None = None
    age: int | None = None
    city: str | None = None
    gender: Gender | None = None
    bio: str | None = Field(default=None, max_length=500)
    quiz_status: QuizStatus
    profile_status: ProfileStatus
    recommendation_mode: RecommendationMode
    search_preferences: SearchPreferences = Field(default_factory=SearchPreferences)
    avatar: AvatarResponse
    lifestyle_tags: list[LifestyleTag] = Field(default_factory=list)
    profile_completion_percent: int = Field(..., ge=0, le=100)
    can_open_feed: bool


class UserPatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    birth_date: date | None = None
    city: str | None = None
    gender: Gender | None = None
    bio: str | None = Field(default=None, max_length=500)
    search_preferences: SearchPreferences | None = None


class UserRolesUpdate(BaseModel):
    roles: list[str] = Field(default_factory=list, description="Role slugs to assign")
