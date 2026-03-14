from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.security import auth_user
from database.relational_db import User
from domain.dating import CompatibilityExplanationResponse, FeedResponse
from service.dating import FeedService, get_feed_service

router = APIRouter()


@router.get(
    "",
    response_model=FeedResponse,
    summary="Get daily personalized feed",
)
async def get_feed(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[FeedService, Depends(get_feed_service)],
    limit: int = Query(12, ge=1, le=20),
) -> FeedResponse:
    return await svc.get_feed(user, limit)


@router.get(
    "/items/{serve_item_id}/explanation",
    response_model=CompatibilityExplanationResponse,
    summary="Get safe compatibility explanation for served card",
)
async def get_feed_item_explanation(
    serve_item_id: UUID,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[FeedService, Depends(get_feed_service)],
) -> CompatibilityExplanationResponse:
    return await svc.get_explanation(user, serve_item_id)
