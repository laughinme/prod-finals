from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path

from core.security import auth_user
from database.relational_db import User
from domain.notifications import ConversationReadResponse
from service.conversations import ConversationService, get_conversation_service

router = APIRouter()


@router.post(
    "/{conversation_id}/read",
    response_model=ConversationReadResponse,
    summary="Mark conversation messages as read for current user",
)
async def mark_conversation_read(
    conversation_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
) -> ConversationReadResponse:
    return await svc.mark_read(user=user, conversation_id=conversation_id)
