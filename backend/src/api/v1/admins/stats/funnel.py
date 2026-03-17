from typing import Annotated

from fastapi import APIRouter, Depends, Query

from core.security import require
from database.relational_db import User
from domain.statistics import FunnelDailyRow, FunnelSummary
from service.statistics import StatService, get_stats_service

router = APIRouter()


@router.get(
    path="/funnel/summary",
    response_model=FunnelSummary,
    summary="Get product funnel summary counters with segmentation",
)
async def funnel_summary(
    _: Annotated[User, Depends(require("admin"))],
    svc: Annotated[StatService, Depends(get_stats_service)],
):
    return await svc.funnel_summary()


@router.get(
    path="/funnel/daily",
    response_model=list[FunnelDailyRow],
    summary="Get product funnel daily counters with segmentation",
)
async def funnel_daily(
    _: Annotated[User, Depends(require("admin"))],
    svc: Annotated[StatService, Depends(get_stats_service)],
    days: int = Query(
        30,
        ge=1,
        le=365,
        description="Number of days back to retrieve daily funnel rows for",
    ),
):
    return await svc.funnel_daily(days)
