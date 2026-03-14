from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path

from core.security import auth_user
from database.relational_db import User
from domain.dating import CloseMatchRequest, CloseMatchResponse
from service.dating import MatchService, get_match_service

router = APIRouter()


@router.post(
    "/{match_id}/close",
    response_model=CloseMatchResponse,
    summary="Close match without blocking",
)
async def close_match(
    payload: CloseMatchRequest,
    match_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[MatchService, Depends(get_match_service)] = ...,
) -> CloseMatchResponse:
    return await svc.close_match(user=user, match_id=match_id, payload=payload)
