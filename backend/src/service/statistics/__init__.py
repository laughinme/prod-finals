from fastapi import Depends

from database.relational_db import MatchmakingInterface, UoW, UserInterface, get_uow
from .statistics_service import StatService


async def get_stats_service(
    uow: UoW = Depends(get_uow),
) -> StatService:
    user_repo = UserInterface(uow.session)
    matchmaking_repo = MatchmakingInterface(uow.session)
    return StatService(uow, user_repo, matchmaking_repo)
