from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AvatarPresignRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: Literal["image/jpeg", "image/png", "image/webp"]


class AvatarPresignResponse(BaseModel):
    file_key: str = Field(..., min_length=1)
    upload_url: str = Field(..., min_length=1)
    expires_at: datetime
    max_size_mb: int = Field(..., gt=0)


class AvatarConfirmRequest(BaseModel):
    file_key: str = Field(..., min_length=1, max_length=1024)
