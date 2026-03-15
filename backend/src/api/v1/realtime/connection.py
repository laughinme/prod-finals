from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.notifications import RealtimeConnectionResponse
from service.realtime import RealtimeService, get_realtime_service

router = APIRouter()


@router.get(
    "/connection-token",
    response_model=RealtimeConnectionResponse,
    summary="Get Centrifugo connection token for personal realtime channel",
)
async def get_realtime_connection_token(
    user: Annotated[User, Depends(auth_user)],
    realtime: Annotated[RealtimeService, Depends(get_realtime_service)],
) -> RealtimeConnectionResponse:
    return realtime.build_connection_response(user_id=user.id)
