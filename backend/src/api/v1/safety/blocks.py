from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from core.security import auth_user
from database.relational_db import User
from domain.dating import (
    BlockListResponse,
    BlockRequest,
    BlockResponse,
    UnblockResponse,
)
from service.safety import SafetyService, get_safety_service

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


@router.get(
    "/blocks",
    response_model=BlockListResponse,
    status_code=status.HTTP_200_OK,
    summary="List blocked users",
)
async def list_blocks(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[SafetyService, Depends(get_safety_service)],
) -> BlockListResponse:
    return await svc.list_blocks(actor=user)


@router.delete(
    "/blocks/{target_user_id}",
    response_model=UnblockResponse,
    status_code=status.HTTP_200_OK,
    summary="Unblock a user",
)
async def delete_block(
    target_user_id: UUID,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[SafetyService, Depends(get_safety_service)],
) -> UnblockResponse:
    return await svc.unblock(actor=user, target_user_id=target_user_id)
