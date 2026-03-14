from typing import Annotated, Literal
from fastapi import APIRouter, Depends, Header, Response

from core.http.cookies import set_auth_cookies
from service.auth import CredentialsService, get_credentials_service
from domain.auth import TokenPairWithUser, UserRegister
from service.users import UserService, get_user_service

router = APIRouter()


@router.post(
    path='/register',
    response_model=TokenPairWithUser,
    status_code=201,
    responses={409: {"description": "User with provided credentials already exists"}},
)
async def register_user(
    response: Response,
    payload: UserRegister,
    svc: Annotated[CredentialsService, Depends(get_credentials_service)],
    user_svc: Annotated[UserService, Depends(get_user_service)],
    client: Literal['web', 'mobile'] = Header('web', alias='X-Client'),
) -> TokenPairWithUser:
    user, access, refresh, csrf = await svc.register(payload, client)
    
    if client == 'web':
        set_auth_cookies(response, refresh, csrf)
    
    return TokenPairWithUser(
        access_token=access,
        refresh_token=refresh,
        user=await user_svc.serialize_user(user),
    )
