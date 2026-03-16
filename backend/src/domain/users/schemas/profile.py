from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from domain.common import TimestampModel
from domain.dating.schemas import AgeRange, SearchPreferences
from domain.users.enums import Gender


class CityRef(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=128)


class UserModel(TimestampModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID = Field(...)
    email: EmailStr = Field(..., description="User e-mail")
    first_name: str | None = Field(None, max_length=80)
    last_name: str | None = Field(None, max_length=80)
    avatar_key: str | None = Field(None, description="Storage key of the avatar object")
    avatar_url: str | None = Field(None, description="Public URL of the avatar object")
    avatar_status: str | None = None
    avatar_rejection_reason: str | None = None
    birth_date: date | None = None
    bio: str | None = Field(None, max_length=500)
    city: CityRef | None = None
    gender: Gender | None = None
    looking_for_genders: list[Gender] = Field(default_factory=list)
    age_range: AgeRange | None = None
    distance_km: int | None = Field(None, ge=1, le=300)
    goal: str | None = None
    interests: list[str] = Field(default_factory=list)
    import_transactions: bool = True
    quiz_started: bool = False
    is_onboarded: bool
    onboarding_status: str
    has_min_profile: bool
    missing_required_fields: list[str] = Field(default_factory=list)
    required_profile_step_key: str | None = None
    has_approved_photo: bool
    profile_status: str
    banned: bool
    role_slugs: list[str] = Field(default_factory=list, description="User's roles.")


class UserPatch(BaseModel):
    first_name: str | None = Field(None, max_length=80)
    last_name: str | None = Field(None, max_length=80)
    birth_date: date | None = None
    bio: str | None = Field(None, max_length=500)
    city_id: str | None = Field(None, max_length=64)
    city: str | None = Field(None, max_length=128)
    gender: Gender | None = None
    looking_for_genders: list[Gender] | None = Field(None, min_length=1, max_length=3)
    age_range: AgeRange | None = None
    distance_km: int | None = Field(None, ge=1, le=300)
    goal: str | None = None
    interests: list[str] | None = Field(None, max_length=15)
    import_transactions: bool | None = None
    search_preferences: SearchPreferences | None = None

    @model_validator(mode="after")
    def normalize_lists(self):
        if self.looking_for_genders is not None:
            self.looking_for_genders = list(dict.fromkeys(self.looking_for_genders))
        if self.interests is not None:
            self.interests = list(dict.fromkeys(item.strip() for item in self.interests if item and item.strip()))
        return self


class UserRolesUpdate(BaseModel):
    roles: list[str] = Field(default_factory=list, description="Role slugs to assign")
