from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path

from core.security import auth_user
from database.relational_db import User
from domain.dating import ConversationResponse
from service.conversations import ConversationService, get_conversation_service

router = APIRouter()


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get conversation metadata",
)
async def get_conversation(
    conversation_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
) -> ConversationResponse:
    return await svc.get_conversation(user=user, conversation_id=conversation_id)
