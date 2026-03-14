from typing import Annotated

from fastapi import APIRouter, Depends, status

from core.security import auth_user
from database.relational_db import User
from domain.dating import ReportRequest, ReportResponse
from service.dating import SafetyService, get_safety_service

router = APIRouter()


@router.post(
    "/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a user",
)
async def post_report(
    payload: ReportRequest,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[SafetyService, Depends(get_safety_service)],
) -> ReportResponse:
    return await svc.report(actor=user, payload=payload)
