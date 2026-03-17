from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx

from core.config import Settings, get_settings
from database.relational_db import MatchmakingInterface, UoW, get_session_factory


logger = logging.getLogger(__name__)


async def _dispatch_events(
    *,
    settings: Settings,
    topic: str,
    path: str,
    payload_builder,
    batch_size: int,
    retry_delay_sec: int,
) -> int:
    if not settings.ML_SERVICE_URL:
        return 0

    session_factory = get_session_factory(settings)
    now = datetime.now(UTC)

    async with session_factory() as session:
        async with UoW(session) as uow:
            repo = MatchmakingInterface(session)
            events = await repo.claim_pending_outbox_events(
                topic=topic, limit=batch_size, now=now
            )
            await uow.commit()

    if not events:
        return 0

    delivered = 0
    failed_ids: set[str] = set()
    headers = {"X-Service-Token": settings.ML_SERVICE_TOKEN}

    async with httpx.AsyncClient(timeout=5.0) as client:
        for event in events:
            try:
                response = await client.post(
                    f"{settings.ML_SERVICE_URL.rstrip('/')}{path}",
                    json=payload_builder(event),
                    headers=headers,
                )
                response.raise_for_status()
                delivered += 1
            except Exception as exc:
                failed_ids.add(str(event.id))
                logger.warning(
                    "Failed to dispatch ML outbox event %s: %s", event.id, exc
                )

    retry_at = datetime.now(UTC) + timedelta(seconds=retry_delay_sec)
    async with session_factory() as session:
        async with UoW(session) as uow:
            repo = MatchmakingInterface(session)
            for event in events:
                if str(event.id) in failed_ids:
                    await repo.update_outbox_event(
                        event_id=event.id, status="pending", available_at=retry_at
                    )
                else:
                    await repo.update_outbox_event(
                        event_id=event.id, status="sent", available_at=None
                    )
            await uow.commit()

    return delivered


async def dispatch_ml_swipe_events(
    *,
    settings: Settings | None = None,
    batch_size: int = 100,
    retry_delay_sec: int = 60,
) -> int:
    settings = settings or get_settings()
    return await _dispatch_events(
        settings=settings,
        topic="ml.interactions.swipe",
        path="/v1/interactions/swipe",
        batch_size=batch_size,
        retry_delay_sec=retry_delay_sec,
        payload_builder=lambda event: {
            **(
                {
                    "trace_id": str(uuid4()),
                    "event_id": str(event.id),
                }
            ),
            "actor_user_id": (event.payload or {}).get("actor_user_id"),
            "target_user_id": (event.payload or {}).get("target_user_id"),
            "action": (event.payload or {}).get("action"),
            "acted_at": datetime.now(UTC).isoformat(),
            "source_context": "feed",
        },
    )


async def dispatch_ml_match_outcome_events(
    *,
    settings: Settings | None = None,
    batch_size: int = 100,
    retry_delay_sec: int = 60,
) -> int:
    settings = settings or get_settings()
    return await _dispatch_events(
        settings=settings,
        topic="ml.interactions.match_outcome",
        path="/v1/interactions/match-outcome",
        batch_size=batch_size,
        retry_delay_sec=retry_delay_sec,
        payload_builder=lambda event: {
            "trace_id": str(uuid4()),
            "event_id": str(event.id),
            "match_id": (event.payload or {}).get("match_id"),
            "user_a_id": (event.payload or {}).get("user_a_id"),
            "user_b_id": (event.payload or {}).get("user_b_id"),
            "outcome": (event.payload or {}).get("outcome"),
            "happened_at": (event.payload or {}).get("happened_at")
            or datetime.now(UTC).isoformat(),
        },
    )
