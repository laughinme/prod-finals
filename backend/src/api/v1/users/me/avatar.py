from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from core.security import auth_user
from database.relational_db import User
from domain.dating import AvatarResponse
from domain.users.schemas.avatar import AvatarConfirmRequest, AvatarPresignRequest, AvatarPresignResponse
from service.users import UserService, get_user_service

router = APIRouter()


@router.post(
    path="/me/avatar/presign",
    response_model=AvatarPresignResponse,
    summary="Create presigned URL for avatar upload",
)
async def create_avatar_presigned_upload(
    payload: AvatarPresignRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserService, Depends(get_user_service)],
) -> AvatarPresignResponse:
    return await svc.create_avatar_presign(
        user=user,
        filename=payload.filename,
        content_type=payload.content_type,
    )


@router.post(
    path="/me/avatar/confirm",
    response_model=AvatarResponse,
    summary="Confirm uploaded avatar and attach it to profile",
)
async def confirm_avatar_upload(
    payload: AvatarConfirmRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserService, Depends(get_user_service)],
) -> AvatarResponse:
    return await svc.confirm_avatar_upload(user=user, file_key=payload.file_key)


@router.get(
    path="/me/avatar",
    response_model=AvatarResponse,
    summary="Get current user avatar",
)
async def get_avatar(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserService, Depends(get_user_service)],
) -> AvatarResponse:
    return await svc.get_avatar(user=user)


@router.delete(
    path="/me/avatar",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove current user avatar",
)
async def delete_avatar(
    response: Response,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserService, Depends(get_user_service)],
) -> None:
    await svc.remove_avatar(user=user)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None
