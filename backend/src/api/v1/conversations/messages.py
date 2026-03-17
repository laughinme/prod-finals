from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status

from core.security import auth_user
from database.relational_db import User
from domain.dating import (
    ConversationMessagesResponse,
    MessageResponse,
    SendMessageRequest,
)
from service.conversations import ConversationService, get_conversation_service

router = APIRouter()


@router.get(
    "/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
    summary="Get conversation messages",
)
async def get_conversation_messages(
    conversation_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
) -> ConversationMessagesResponse:
    return await svc.list_messages(
        user=user, conversation_id=conversation_id, cursor=cursor, limit=limit
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send message to conversation",
)
async def post_conversation_message(
    payload: SendMessageRequest,
    conversation_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
) -> MessageResponse:
    return await svc.send_message(
        user=user, conversation_id=conversation_id, payload=payload
    )
