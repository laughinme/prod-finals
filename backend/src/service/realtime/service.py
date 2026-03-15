import asyncio
import json
from datetime import UTC, datetime, timedelta
from urllib import request

import jwt

from core.config import Settings, get_settings
from domain.notifications import MatchCreatedEventPayload, RealtimeConnectionResponse


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

    def build_connection_response(self, *, user_id) -> RealtimeConnectionResponse:
        if not self.is_enabled:
            return RealtimeConnectionResponse(enabled=False)

        expires_at = datetime.now(UTC) + timedelta(seconds=self.settings.CENTRIFUGO_TOKEN_TTL_SEC)
        channel = f"personal:{user_id}"
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

    async def publish_match_created(self, *, user_id, payload: MatchCreatedEventPayload) -> None:
        if not self.is_enabled:
            return
        publication = {
            "channel": f"personal:{user_id}",
            "data": {
                "type": "match_created",
                "payload": payload.model_dump(mode="json"),
            },
        }
        await asyncio.to_thread(self._post_publication, publication)

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
