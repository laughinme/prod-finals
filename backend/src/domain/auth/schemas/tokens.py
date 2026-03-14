from pydantic import BaseModel, Field

from core.config import get_settings


settings = get_settings()


class TokenPair(BaseModel):
    access_token: str = Field(...)
    refresh_token: str | None = Field(None)
    token_type: str = Field(default="bearer")
    expires_in: int = Field(default=settings.ACCESS_TTL, ge=1)


class TokenSet(TokenPair):
    csrf_token: str | None = Field(None)
