from typing import Annotated

from fastapi import APIRouter, Depends, status

from core.security import auth_user
from database.relational_db import User
from domain.dating import BlockRequest, BlockResponse
from service.dating import SafetyService, get_safety_service

router = APIRouter()


@router.post(
    "/blocks",
    response_model=BlockResponse,
    status_code=status.HTTP_200_OK,
    summary="Block a user",
)
async def post_block(
    payload: BlockRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[SafetyService, Depends(get_safety_service)],
) -> BlockResponse:
    return await svc.block(actor=user, payload=payload)
