from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path

from core.security import auth_user
from database.relational_db import User
from domain.dating import FeedReactionRequest, FeedReactionResponse, FeedTestMatchResponse
from service.feed import InteractionService, get_interaction_service

router = APIRouter()


@router.post(
    "/items/{serve_item_id}/reaction",
    response_model=FeedReactionResponse,
    summary="Submit reaction to card",
)
async def post_feed_reaction(
    payload: FeedReactionRequest,
    serve_item_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[InteractionService, Depends(get_interaction_service)] = ...,
) -> FeedReactionResponse:
    return await svc.submit_reaction(user=user, serve_item_id=serve_item_id, payload=payload)


@router.post(
    "/items/{serve_item_id}/test-match",
    response_model=FeedTestMatchResponse,
    summary="Prepare reciprocal like for current card (testing)",
)
async def post_feed_test_match(
    serve_item_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[InteractionService, Depends(get_interaction_service)] = ...,
) -> FeedTestMatchResponse:
    return await svc.arm_test_match(user=user, serve_item_id=serve_item_id)
