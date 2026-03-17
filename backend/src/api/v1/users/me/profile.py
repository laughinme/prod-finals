from typing import Annotated

from fastapi import APIRouter, Depends

from database.relational_db import User
from domain.users.schemas.profile import UserModel, UserPatch
from core.security import auth_user
from service.users import UserService, get_user_service

router = APIRouter()


@router.get(path="/me", response_model=UserModel, summary="Get user account info")
async def profile(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserService, Depends(get_user_service)],
) -> UserModel:
    return await svc.serialize_user(user)


@router.patch(path="/me", response_model=UserModel, summary="Update user info")
async def update_profile(
    payload: UserPatch,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[UserService, Depends(get_user_service)],
) -> UserModel:
    updated_user = await svc.patch_user(payload, user)
    return await svc.serialize_user(updated_user)
