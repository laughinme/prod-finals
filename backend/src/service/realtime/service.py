import asyncio
import json
import logging
from datetime import UTC, datetime, timedelta
from urllib import error as urllib_error
from urllib import request

import jwt

from core.config import Settings, get_settings
from domain.notifications import (
    ConversationClosedEventPayload,
    LikeReceivedEventPayload,
    MatchCreatedEventPayload,
    MessageCreatedEventPayload,
    MessageReceivedEventPayload,
    RealtimeConnectionResponse,
    RealtimeSubscriptionResponse,
)

logger = logging.getLogger(__name__)


class RealtimeService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    @property
    def is_enabled(self) -> bool:
        return bool(
            self.settings.CENTRIFUGO_ENABLED
            and self.settings.CENTRIFUGO_WS_URL
            and self.settings.CENTRIFUGO_API_URL
            and self.settings.CENTRIFUGO_API_KEY
            and self.settings.CENTRIFUGO_TOKEN_HMAC_SECRET
        )

    @staticmethod
    def build_personal_channel(*, user_id) -> str:
        return f"personal-{user_id}"

    @staticmethod
    def build_conversation_channel(*, conversation_id) -> str:
        return f"conversation-{conversation_id}"

    def build_connection_response(self, *, user_id) -> RealtimeConnectionResponse:
        if not self.is_enabled:
            return RealtimeConnectionResponse(enabled=False)

        expires_at = datetime.now(UTC) + timedelta(seconds=self.settings.CENTRIFUGO_TOKEN_TTL_SEC)
        channel = self.build_personal_channel(user_id=user_id)
        token = jwt.encode(
            {
                "sub": str(user_id),
                "exp": int(expires_at.timestamp()),
                "channels": [channel],
            },
            self.settings.CENTRIFUGO_TOKEN_HMAC_SECRET,
            algorithm="HS256",
        )
        return RealtimeConnectionResponse(
            enabled=True,
            ws_url=self.settings.CENTRIFUGO_WS_URL,
            token=token,
            expires_at=expires_at,
            channels=[channel],
        )

    def build_subscription_response(
        self,
        *,
        user_id,
        channel: str,
    ) -> RealtimeSubscriptionResponse:
        if not self.is_enabled:
            return RealtimeSubscriptionResponse(enabled=False)

        expires_at = datetime.now(UTC) + timedelta(seconds=self.settings.CENTRIFUGO_TOKEN_TTL_SEC)
        token = jwt.encode(
            {
                "sub": str(user_id),
                "channel": channel,
                "exp": int(expires_at.timestamp()),
            },
            self.settings.CENTRIFUGO_TOKEN_HMAC_SECRET,
            algorithm="HS256",
        )
        return RealtimeSubscriptionResponse(
            enabled=True,
            channel=channel,
            token=token,
            expires_at=expires_at,
        )

    async def publish_match_created(self, *, user_id, payload: MatchCreatedEventPayload) -> None:
        await self._publish_personal_event(
            user_id=user_id,
            event_type="match_created",
            payload=payload.model_dump(mode="json"),
            log_label="match_created",
        )

    async def publish_like_received(self, *, user_id, payload: LikeReceivedEventPayload) -> None:
        await self._publish_personal_event(
            user_id=user_id,
            event_type="like_received",
            payload=payload.model_dump(mode="json"),
            log_label="like_received",
        )

    async def publish_message_received(self, *, user_id, payload: MessageReceivedEventPayload) -> None:
        await self._publish_personal_event(
            user_id=user_id,
            event_type="message_received",
            payload=payload.model_dump(mode="json"),
            log_label="message_received",
        )

    async def _publish_personal_event(
        self,
        *,
        user_id,
        event_type: str,
        payload: dict,
        log_label: str,
    ) -> None:
        if not self.is_enabled:
            return
        publication = {
            "channel": self.build_personal_channel(user_id=user_id),
            "data": {
                "type": event_type,
                "payload": payload,
            },
        }
        try:
            await asyncio.to_thread(self._post_publication, publication)
        except (OSError, urllib_error.URLError, urllib_error.HTTPError) as exc:
            logger.warning("Failed to publish realtime %s notification: %s", log_label, exc)

    async def publish_message_created(
        self,
        *,
        conversation_id,
        payload: MessageCreatedEventPayload,
    ) -> None:
        await self._publish_event(
            channel=self.build_conversation_channel(conversation_id=conversation_id),
            event_type="message_created",
            payload=payload.model_dump(mode="json"),
            log_label="message_created",
        )

    async def publish_conversation_closed(
        self,
        *,
        conversation_id,
        payload: ConversationClosedEventPayload,
    ) -> None:
        await self._publish_event(
            channel=self.build_conversation_channel(conversation_id=conversation_id),
            event_type="conversation_closed",
            payload=payload.model_dump(mode="json"),
            log_label="conversation_closed",
        )

    async def _publish_event(
        self,
        *,
        channel: str,
        event_type: str,
        payload: dict,
        log_label: str,
    ) -> None:
        if not self.is_enabled:
            return
        publication = {
            "channel": channel,
            "data": {
                "type": event_type,
                "payload": payload,
            },
        }
        try:
            await asyncio.to_thread(self._post_publication, publication)
        except (OSError, urllib_error.URLError, urllib_error.HTTPError) as exc:
            logger.warning("Failed to publish realtime %s event: %s", log_label, exc)

    def _post_publication(self, publication: dict) -> None:
        body = json.dumps(publication).encode()
        req = request.Request(
            self.settings.CENTRIFUGO_API_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"apikey {self.settings.CENTRIFUGO_API_KEY}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=5) as response:  # nosec: internal service call
            response.read()
