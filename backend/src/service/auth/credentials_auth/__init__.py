from typing import Annotated
from fastapi import Depends

from database.relational_db import (
    RolesInterface,
    UoW,
    UserInterface,
    get_uow,
)
from service.mock_identity import MockIdentityService, get_mock_identity_registry
from service.notifications import NotificationService, get_notification_service
from .credentials_service import CredentialsService
from ..tokens import TokenService, get_token_service


async def get_credentials_service(
    uow: Annotated[UoW, Depends(get_uow)],
    token_service: Annotated[TokenService, Depends(get_token_service)],
    notification_service: Annotated[NotificationService, Depends(get_notification_service)],
) -> CredentialsService:
    user_repo = UserInterface(uow.session)
    role_repo = RolesInterface(uow.session)
    mock_identity_service = MockIdentityService(
        user_repo,
        get_mock_identity_registry(),
    )

    return CredentialsService(
        uow,
        user_repo,
        role_repo,
        token_service,
        notification_service,
        mock_identity_service,
    )
