from datetime import datetime

from pydantic import BaseModel, Field


class MlConnectionStatusModel(BaseModel):
    configured: bool
    provider: str
    base_url: str | None = None
    reachable: bool
    healthy: bool
    fallback_active: bool
    ml_status: str | None = None
    detail: str | None = None


class RandomMixConfigModel(BaseModel):
    random_mix_percent: int = Field(..., ge=0, le=80)
    updated_at: datetime


class RandomMixConfigUpdateModel(BaseModel):
    random_mix_percent: int = Field(..., ge=0, le=80)
