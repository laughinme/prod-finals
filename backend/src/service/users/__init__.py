from fastapi import Depends

from database.redis import CacheRepo, get_redis
from database.relational_db import (
    CitiesInterface,
    LanguagesInterface,
    MatchmakingInterface,
    RolesInterface,
    UserInterface,
    UoW,
    get_uow,
)
from service.media import MediaStorageService, get_media_storage_service
from service.matchmaking import MlFacade, get_ml_facade
from .user_service import UserService


async def get_user_service(
    uow: UoW = Depends(get_uow),
    redis=Depends(get_redis),
    media_storage: MediaStorageService = Depends(get_media_storage_service),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> UserService:
    user_repo = UserInterface(uow.session)
    city_repo = CitiesInterface(uow.session)
    lang_repo = LanguagesInterface(uow.session)
    role_repo = RolesInterface(uow.session)
    cache_repo = CacheRepo(redis) if redis else None
    return UserService(
        uow=uow,
        user_repo=user_repo,
        city_repo=city_repo,
        matchmaking_repo=MatchmakingInterface(uow.session),
        lang_repo=lang_repo,
        role_repo=role_repo,
        media_storage=media_storage,
        ml_facade=ml_facade,
        cache_repo=cache_repo,
    )
