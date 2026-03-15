from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NotificationPeer(BaseModel):
    user_id: UUID
    display_name: str
    avatar_url: str | None = None


class MatchNotificationItem(BaseModel):
    notification_id: UUID
    match_id: UUID
    conversation_id: UUID
    peer: NotificationPeer
    created_at: datetime
    seen_at: datetime | None = None


class MatchNotificationsResponse(BaseModel):
    items: list[MatchNotificationItem] = Field(default_factory=list)
    unseen_count: int = Field(default=0, ge=0)


class MarkNotificationSeenResponse(BaseModel):
    notification_id: UUID
    seen_at: datetime


class MessageNotificationItem(BaseModel):
    notification_id: UUID
    match_id: UUID
    conversation_id: UUID
    message_id: UUID
    sender: NotificationPeer
    text: str
    created_at: datetime
    seen_at: datetime | None = None
    read_at: datetime | None = None


class MessageNotificationsResponse(BaseModel):
    items: list[MessageNotificationItem] = Field(default_factory=list)
    unseen_count: int = Field(default=0, ge=0)


class RealtimeConnectionResponse(BaseModel):
    enabled: bool
    ws_url: str | None = None
    token: str | None = None
    expires_at: datetime | None = None
    channels: list[str] = Field(default_factory=list)


class RealtimeSubscriptionResponse(BaseModel):
    enabled: bool
    channel: str | None = None
    token: str | None = None
    expires_at: datetime | None = None


class MatchCreatedEventPayload(BaseModel):
    notification_id: UUID
    match_id: UUID
    conversation_id: UUID
    peer: NotificationPeer
    created_at: datetime


class MessageReceivedEventPayload(BaseModel):
    notification_id: UUID
    match_id: UUID
    conversation_id: UUID
    message_id: UUID
    sender: NotificationPeer
    text: str
    created_at: datetime


class MessageCreatedEventPayload(BaseModel):
    conversation_id: UUID
    message_id: UUID
    sender_user_id: UUID
    text: str
    created_at: datetime
    status: str


class ConversationClosedEventPayload(BaseModel):
    conversation_id: UUID
    status: str
    closed_at: datetime


class ConversationReadResponse(BaseModel):
    conversation_id: UUID
    read_at: datetime


class RealtimeEnvelope(BaseModel):
    type: str
    payload: dict
