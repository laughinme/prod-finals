from fastapi import Depends

from core.config import Settings, get_settings
from database.relational_db import MatchmakingInterface, NotificationInterface, UoW, UserInterface, get_uow
from service.realtime import RealtimeService, get_realtime_service

from .ml_facade import HttpMlFacade, MlFacade, MockMlFacade


def get_ml_facade(settings: Settings = Depends(get_settings)) -> MlFacade:
    if settings.ML_SERVICE_URL:
        return HttpMlFacade(
            base_url=settings.ML_SERVICE_URL,
            service_token=settings.ML_SERVICE_TOKEN,
        )
    return MockMlFacade()


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
