from pydantic import BaseModel


class MlConnectionStatusModel(BaseModel):
    configured: bool
    provider: str
    base_url: str | None = None
    reachable: bool
    healthy: bool
    fallback_active: bool
    ml_status: str | None = None
    detail: str | None = None

