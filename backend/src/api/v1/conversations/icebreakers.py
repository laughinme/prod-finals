from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status

from core.security import auth_user
from database.relational_db import User
from domain.dating import IcebreakersResponse, MessageResponse
from service.conversations import ConversationService, get_conversation_service

router = APIRouter()


@router.get(
    "/{conversation_id}/icebreakers",
    response_model=IcebreakersResponse,
    summary="Get templated conversation icebreakers",
)
async def get_conversation_icebreakers(
    conversation_id: UUID = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
) -> IcebreakersResponse:
    return await svc.get_icebreakers(user=user, conversation_id=conversation_id)


@router.post(
    "/{conversation_id}/icebreakers/{icebreaker_id}/send",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send selected icebreaker as a message",
)
async def send_conversation_icebreaker(
    conversation_id: UUID = Path(...),
    icebreaker_id: str = Path(...),
    user: Annotated[User, Depends(auth_user)] = ...,
    svc: Annotated[ConversationService, Depends(get_conversation_service)] = ...,
) -> MessageResponse:
    return await svc.send_icebreaker(
        user=user, conversation_id=conversation_id, icebreaker_id=icebreaker_id
    )
