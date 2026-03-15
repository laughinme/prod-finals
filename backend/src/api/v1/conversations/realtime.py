from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path

from core.security import auth_user
from database.relational_db import User
from domain.notifications import RealtimeSubscriptionResponse
from service.conversations import ConversationService, get_conversation_service

router = APIRouter()


@router.get(
    "/{conversation_id}/realtime-token",
    response_model=RealtimeSubscriptionResponse,
    summary="Get Centrifugo subscription token for conversation realtime channel",
)
async def get_conversation_realtime_token(
    conversation_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
) -> RealtimeSubscriptionResponse:
    return await svc.get_realtime_token(user=user, conversation_id=conversation_id)
