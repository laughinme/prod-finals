from functools import lru_cache

from fastapi import Depends

from core.config import Settings, get_settings
from database.relational_db import (
    MatchmakingInterface,
    NotificationInterface,
    UoW,
    UserInterface,
    get_uow,
)
from service.realtime import RealtimeService, get_realtime_service

from .ml_facade import HttpMlFacade, MlFacade, MockMlFacade
from .preview_text_generator import LlmCategoryPreviewGenerator


@lru_cache
def _get_preview_text_generator(
    enabled: bool,
    provider: str,
    base_url: str,
    api_key: str,
    model: str,
    timeout_sec: float,
) -> LlmCategoryPreviewGenerator:
    return LlmCategoryPreviewGenerator(
        enabled=enabled,
        provider=provider,
        base_url=base_url,
        api_key=api_key,
        model=model,
        timeout_sec=timeout_sec,
    )


def get_ml_facade(settings: Settings = Depends(get_settings)) -> MlFacade:
    preview_text_generator = _get_preview_text_generator(
        bool(settings.ML_PREVIEW_LLM_ENABLED),
        settings.ML_PREVIEW_LLM_PROVIDER,
        settings.ML_PREVIEW_LLM_BASE_URL,
        settings.ML_PREVIEW_LLM_API_KEY,
        settings.ML_PREVIEW_LLM_MODEL,
        float(settings.ML_PREVIEW_LLM_TIMEOUT_SEC),
    )
    if settings.ML_SERVICE_URL:
        return HttpMlFacade(
            base_url=settings.ML_SERVICE_URL,
            service_token=settings.ML_SERVICE_TOKEN,
            preview_text_generator=preview_text_generator,
        )
    return MockMlFacade(preview_text_generator=preview_text_generator)


def build_matchmaking_common(uow: UoW, ml_facade: MlFacade) -> dict:
    return {
        "uow": uow,
        "user_repo": UserInterface(uow.session),
        "matchmaking_repo": MatchmakingInterface(uow.session),
        "notification_repo": NotificationInterface(uow.session),
        "realtime_service": RealtimeService(),
        "ml_facade": ml_facade,
    }


async def get_matchmaking_common(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
    realtime_service: RealtimeService = Depends(get_realtime_service),
) -> dict:
    common = build_matchmaking_common(uow, ml_facade)
    common["realtime_service"] = realtime_service
    return common
