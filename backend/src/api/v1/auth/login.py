from typing import Annotated, Literal
from fastapi import APIRouter, Depends, Header, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.errors import UnauthorizedError
from core.http.cookies import clear_auth_cookies, set_auth_cookies
from service.auth import CredentialsService, get_credentials_service
from domain.auth import DemoLoginRequest, TokenPairWithUser, UserLogin
from service.users import UserService, get_user_service

router = APIRouter()
security = HTTPBearer(
    auto_error=False, 
    description='Send refresh token as Bearer for non-browser clients'
)


@router.post(
    path="/login",
    response_model=TokenPairWithUser,
    summary="Authenticate user and issue tokens",
    responses={401: {"description": "Wrong credentials"}},
)
async def login_user(
    response: Response,
    payload: UserLogin,
    svc: Annotated[CredentialsService, Depends(get_credentials_service)],
    user_svc: Annotated[UserService, Depends(get_user_service)],
    client: Literal['web', 'mobile'] = Header('web', alias='X-Client'),
) -> TokenPairWithUser:
    user, access, refresh, csrf = await svc.login(payload, client)
    
    if client == 'web':
        set_auth_cookies(response, refresh, csrf)
    
    return TokenPairWithUser(
        access_token=access,
        refresh_token=refresh,
        user=await user_svc.serialize_user(user),
    )


@router.post(
    path="/demo-login",
    response_model=TokenPairWithUser,
    summary="Demo-only login using seeded user aliases",
)
async def demo_login(
    response: Response,
    payload: DemoLoginRequest,
    svc: Annotated[CredentialsService, Depends(get_credentials_service)],
    user_svc: Annotated[UserService, Depends(get_user_service)],
    client: Literal["web", "mobile"] = Header("web", alias="X-Client"),
) -> TokenPairWithUser:
    user, access, refresh, csrf = await svc.demo_login(payload, client)

    if client == "web":
        set_auth_cookies(response, refresh, csrf)

    return TokenPairWithUser(
        access_token=access,
        refresh_token=refresh,
        user=await user_svc.serialize_user(user),
    )


@router.post(
    path="/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"description": "Not authorized"}}
)
async def logout(
    request: Request,
    response: Response,
    svc: Annotated[CredentialsService, Depends(get_credentials_service)],
    creds: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> Response:
    refresh_cookie = request.cookies.get("refresh_token")
    
    refresh_header = (
        creds.credentials if creds and creds.scheme.lower() == "bearer" else None
    )

    token = refresh_cookie or refresh_header
    if token is None:
        raise UnauthorizedError("Refresh token is not passed")
    
    await svc.logout(token)
    
    if refresh_cookie:
        clear_auth_cookies(response)

    response.status_code = status.HTTP_204_NO_CONTENT
    return response
