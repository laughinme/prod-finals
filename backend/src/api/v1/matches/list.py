from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import auth_user
from database.relational_db import User
from domain.dating import MatchListResponse
from service.dating import MatchService, get_match_service

router = APIRouter()


@router.get(
    "",
    response_model=MatchListResponse,
    summary="Get current user's matches",
)
async def get_matches(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[MatchService, Depends(get_match_service)],
) -> MatchListResponse:
    return await svc.list_matches(user)
