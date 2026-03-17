from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query

from core.security import auth_user, require
from database.relational_db import User
from domain.moderation import (
    ModerationReportListResponse,
    ModerationReportStatus,
    ModerationReportSummary,
    ModerationReviewRequest,
    ModerationReviewResponse,
)
from service.moderation import ModerationService, get_moderation_service


router = APIRouter(prefix="/reports")


@router.get(
    path="/summary",
    response_model=ModerationReportSummary,
    summary="Get moderation report queue summary",
)
async def get_report_summary(
    _: Annotated[User, Depends(require("admin"))],
    svc: Annotated[ModerationService, Depends(get_moderation_service)],
):
    return await svc.get_report_summary()


@router.get(
    path="/",
    response_model=ModerationReportListResponse,
    summary="List moderation reports",
)
async def list_reports(
    _: Annotated[User, Depends(require("admin"))],
    svc: Annotated[ModerationService, Depends(get_moderation_service)],
    status: ModerationReportStatus | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    return await svc.list_reports(status=status, limit=limit)


@router.post(
    path="/{report_id}/review",
    response_model=ModerationReviewResponse,
    summary="Review moderation report",
)
async def review_report(
    report_id: Annotated[UUID, Path(...)],
    payload: ModerationReviewRequest,
    _: Annotated[None, Depends(require("admin"))],
    actor: Annotated[User, Depends(auth_user)],
    svc: Annotated[ModerationService, Depends(get_moderation_service)],
):
    return await svc.review_report(report_id=report_id, reviewer=actor, payload=payload)
