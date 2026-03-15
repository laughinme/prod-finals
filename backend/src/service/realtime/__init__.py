from fastapi import Depends

from core.config import Settings, get_settings

from .service import RealtimeService


def get_realtime_service(settings: Settings = Depends(get_settings)) -> RealtimeService:
    return RealtimeService(settings=settings)


__all__ = ["RealtimeService", "get_realtime_service"]
