from __future__ import annotations

import os
from uuid import uuid4

from fastapi.testclient import TestClient

from ml.main import app


def _headers() -> dict[str, str]:
    token = os.getenv("ML_SERVICE_TOKEN", "dev-ml-token")
    return {"X-Service-Token": token}


def test_health_returns_200() -> None:
    client = TestClient(app)
    response = client.get("/v1/health", headers=_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ok", "degraded"}
    assert "checks" in payload


def test_recommendations_returns_candidates() -> None:
    client = TestClient(app)
    trace_id = str(uuid4())
    response = client.post(
        "/v1/recommendations",
        headers=_headers(),
        json={
            "trace_id": trace_id,
            "request_user_id": 1,
            "limit": 5,
            "strategy": "balanced",
            "context": {
                "request_ts": "2026-03-13T19:00:00Z",
                "session_id": "sess_1",
                "locale": "ru-RU",
                "timezone": "Europe/Moscow",
                "client": "web",
                "decision_policy": "daily_batch",
            },
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["trace_id"] == trace_id
    assert len(payload["candidates"]) <= 5


def test_feedback_swipe_returns_202() -> None:
    client = TestClient(app)
    response = client.post(
        "/v1/interactions/swipe",
        headers=_headers(),
        json={
            "trace_id": str(uuid4()),
            "event_id": str(uuid4()),
            "actor_user_id": 1,
            "target_user_id": 2,
            "action": "hide",
            "acted_at": "2026-03-13T19:00:16Z",
        },
    )
    assert response.status_code == 202
    assert response.json()["status"] == "accepted"


def test_onboarding_profile_update_returns_202_with_import_transactions() -> None:
    client = TestClient(app)
    response = client.post(
        "/v1/profiles/onboarding",
        headers=_headers(),
        json={
            "trace_id": str(uuid4()),
            "user_id": "cold-user-1",
            "favorite_categories": ["coffee", "entertainment", "travel"],
            "import_transactions": True,
            "preferred_activity_hour": 18.0,
        },
    )
    assert response.status_code == 202
    assert response.json()["status"] == "accepted"
