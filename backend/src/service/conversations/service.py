from datetime import datetime
from uuid import uuid4

from core.errors import BadRequestError
from database.relational_db import Message, User
from domain.dating import (
    AuditEntityType,
    ConversationMessagesResponse,
    ConversationPeer,
    ConversationResponse,
    ConversationSafetyActions,
    ConversationStatus,
    IcebreakersResponse,
    MessageResponse,
    MessageStatus,
    SendMessageRequest,
)
from domain.notifications import (
    ConversationClosedEventPayload,
    ConversationReadResponse,
    MessageCreatedEventPayload,
    MessageReceivedEventPayload,
    NotificationPeer,
    RealtimeSubscriptionResponse,
)

from service.matchmaking import BaseDatingService, ConversationNotFoundError, ConversationUnavailableError


class ConversationService(BaseDatingService):
    async def get_conversation(self, *, user: User, conversation_id) -> ConversationResponse:
        row = await self.matchmaking_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        conversation, match, peer = row
        return ConversationResponse(
            conversation_id=conversation.id,
            match_id=match.id,
            status=conversation.status,
            peer=ConversationPeer(
                user_id=peer.id,
                display_name=peer.resolved_display_name or "",
                avatar_url=peer.avatar_url,
            ),
            safety_actions=ConversationSafetyActions(can_block=True, can_report=True),
        )

    async def list_messages(
        self,
        *,
        user: User,
        conversation_id,
        cursor: str | None,
        limit: int,
    ) -> ConversationMessagesResponse:
        row = await self.matchmaking_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        conversation, _match, _peer = row
        try:
            parsed_cursor = datetime.fromisoformat(cursor) if cursor else None
        except ValueError as exc:
            raise BadRequestError("Invalid cursor") from exc
        messages = await self.matchmaking_repo.list_messages(
            conversation_id=conversation_id,
            cursor=parsed_cursor,
            limit=limit,
        )
        next_cursor = None
        if len(messages) > limit:
            next_cursor = messages[-1].created_at.isoformat()
            messages = messages[:-1]
        messages = list(reversed(messages))
        response = ConversationMessagesResponse(
            items=[
                MessageResponse(
                    message_id=message.id,
                    sender_user_id=message.sender_user_id,
                    text=message.text,
                    created_at=message.created_at,
                    status=MessageStatus.SENT,
                )
                for message in messages
            ],
            next_cursor=next_cursor,
        )
        if cursor is None:
            await self.notification_repo.mark_conversation_message_notifications_read(
                user_id=user.id,
                conversation_id=conversation.id,
                read_at=self.now(),
            )
            await self.uow.commit()
        return response

    async def get_realtime_token(
        self,
        *,
        user: User,
        conversation_id,
    ) -> RealtimeSubscriptionResponse:
        row = await self.matchmaking_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        return self.realtime_service.build_subscription_response(
            user_id=user.id,
            channel=self.realtime_service.build_conversation_channel(conversation_id=conversation_id),
        )

    async def send_message(
        self,
        *,
        user: User,
        conversation_id,
        payload: SendMessageRequest,
    ) -> MessageResponse:
        row = await self.matchmaking_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        conversation, match, peer = row
        if conversation.status != ConversationStatus.ACTIVE.value:
            raise ConversationUnavailableError()

        message = await self.matchmaking_repo.add(
            Message(
                conversation_id=conversation.id,
                sender_user_id=user.id,
                client_message_id=uuid4(),
                text=payload.text,
            )
        )
        await self.add_audit_event(
            event_type="message_sent",
            entity_type=AuditEntityType.CONVERSATION,
            entity_id=str(conversation.id),
            actor_user_id=user.id,
            payload={"match_id": str(match.id)},
        )
        notification = await self.notification_repo.add_message_notification(
            user_id=peer.id,
            match_id=match.id,
            conversation_id=conversation.id,
            message_id=message.id,
            sender_user_id=user.id,
        )
        await self.uow.commit()
        response = MessageResponse(
            message_id=message.id,
            sender_user_id=message.sender_user_id,
            text=message.text,
            created_at=message.created_at,
            status=MessageStatus.SENT,
        )
        await self.realtime_service.publish_message_created(
            conversation_id=conversation.id,
            payload=MessageCreatedEventPayload(
                conversation_id=conversation.id,
                message_id=message.id,
                sender_user_id=message.sender_user_id,
                text=message.text,
                created_at=message.created_at,
                status=MessageStatus.SENT.value,
            ),
        )
        await self.realtime_service.publish_message_received(
            user_id=peer.id,
            payload=MessageReceivedEventPayload(
                notification_id=notification.id,
                match_id=match.id,
                conversation_id=conversation.id,
                message_id=message.id,
                sender=NotificationPeer(
                    user_id=user.id,
                    display_name=user.resolved_display_name or "",
                    avatar_url=user.avatar_url,
                ),
                text=message.text,
                created_at=message.created_at,
            ),
        )
        return response

    async def mark_read(
        self,
        *,
        user: User,
        conversation_id,
    ) -> ConversationReadResponse:
        row = await self.matchmaking_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        now = self.now()
        await self.notification_repo.mark_conversation_message_notifications_read(
            user_id=user.id,
            conversation_id=conversation_id,
            read_at=now,
        )
        await self.uow.commit()
        return ConversationReadResponse(conversation_id=conversation_id, read_at=now)

    async def get_icebreakers(self, *, user: User, conversation_id) -> IcebreakersResponse:
        row = await self.matchmaking_repo.get_conversation_for_user(conversation_id=conversation_id, user_id=user.id)
        if row is None:
            raise ConversationNotFoundError()
        _conversation, _match, peer = row
        return self.ml_facade.build_icebreakers(
            requester=await self._build_feed_context(user),
            candidate=await self._build_feed_context(peer),
        )

    async def send_icebreaker(self, *, user: User, conversation_id, icebreaker_id: str) -> MessageResponse:
        icebreakers = await self.get_icebreakers(user=user, conversation_id=conversation_id)
        item = next((icebreaker for icebreaker in icebreakers.items if icebreaker.icebreaker_id == icebreaker_id), None)
        if item is None:
            raise BadRequestError("Unknown icebreaker")
        return await self.send_message(
            user=user,
            conversation_id=conversation_id,
            payload=SendMessageRequest(text=item.text),
        )
