from pydantic import BaseModel, Field
from uuid import UUID


class UserShare(BaseModel):
    """
    User schema making possible to share other users public profile data.
    """

    id: UUID = Field(...)
    first_name: str | None = Field(None, description="User first name")
    last_name: str | None = Field(None, description="User last name")
    avatar_url: str | None = Field(None, description="Public URL of the avatar object")


class UserBrief(BaseModel):
    id: UUID = Field(...)
    first_name: str | None = Field(None, description="User first name")
    last_name: str | None = Field(None, description="User last name")
    avatar_url: str | None = Field(None, description="Public URL of the avatar object")
