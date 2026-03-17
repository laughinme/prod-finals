from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.security import auth_user
from database.relational_db import User
from domain.dating import (
    CompatibilityExplanationResponse,
    DemoFeedShortcutListResponse,
    DemoFeedResetResponse,
    FeedCard,
    FeedResponse,
)
from service.feed import FeedService, get_feed_service

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
    "/demo-shortcuts",
    response_model=DemoFeedShortcutListResponse,
    summary="List demo shortcuts for discovery",
)
async def get_demo_shortcuts(
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[FeedService, Depends(get_feed_service)],
) -> DemoFeedShortcutListResponse:
    return await svc.list_demo_shortcuts(user)


@router.get(
    "/demo-shortcuts/{demo_user_key}/card",
    response_model=FeedCard,
    summary="Open a demo shortcut card",
)
async def get_demo_shortcut_card(
    demo_user_key: str,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[FeedService, Depends(get_feed_service)],
) -> FeedCard:
    return await svc.get_demo_card(user=user, demo_user_key=demo_user_key)


@router.post(
    "/demo-shortcuts/{demo_user_key}/reset",
    response_model=DemoFeedResetResponse,
    summary="Reset a demo pair so it can be matched again",
)
async def reset_demo_shortcut_pair(
    demo_user_key: str,
    user: Annotated[User, Depends(auth_user)],
    svc: Annotated[FeedService, Depends(get_feed_service)],
) -> DemoFeedResetResponse:
    return await svc.reset_demo_pair(user=user, demo_user_key=demo_user_key)


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
