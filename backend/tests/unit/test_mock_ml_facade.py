from datetime import date
from uuid import uuid4

import pytest

from domain.dating import AgeRange, FeedCandidateContext, SearchPreferences
from domain.dating.category_catalog import load_category_definitions
from service.matchmaking.ml_facade import HttpMlFacade, MockMlFacade


@pytest.mark.unit
@pytest.mark.asyncio
async def test_mock_ml_facade_prefers_better_matching_candidate():
    facade = MockMlFacade()
    requester = FeedCandidateContext(
        user_id=uuid4(),
        display_name="Anna",
        birth_date=date(1998, 5, 12),
        city="Moscow",
        gender="female",
        search_preferences=SearchPreferences(
            looking_for_genders=["male"],
            age_range=AgeRange(min=25, max=35),
            distance_km=30,
            goal="casual_dates",
        ),
        bio="Coffee and theater",
        avatar_url="https://example.com/a.png",
        profile_completion_percent=100,
    )
    strong = FeedCandidateContext(
        user_id=uuid4(),
        display_name="Dima",
        birth_date=date(1995, 7, 1),
        city="Moscow",
        gender="male",
        search_preferences=SearchPreferences(
            looking_for_genders=["female"],
            age_range=AgeRange(min=24, max=33),
            distance_km=30,
            goal="casual_dates",
        ),
        bio="Theater and sport",
        avatar_url="https://example.com/b.png",
        profile_completion_percent=95,
    )
    weak = FeedCandidateContext(
        user_id=uuid4(),
        display_name="Roma",
        birth_date=date(1990, 1, 1),
        city="Saint Petersburg",
        gender="male",
        search_preferences=SearchPreferences(
            looking_for_genders=["female"],
            age_range=AgeRange(min=30, max=40),
            distance_km=30,
            goal="new_friends",
        ),
        bio=None,
        avatar_url="https://example.com/c.png",
        profile_completion_percent=50,
    )

    ranked = await facade.rank(requester, [weak, strong], limit=2)

    assert ranked.decision_mode.value == "fallback"
    assert ranked.candidates[0].candidate_user_id == strong.user_id
    assert ranked.candidates[0].score > ranked.candidates[1].score


@pytest.mark.unit
@pytest.mark.asyncio
async def test_http_ml_facade_connection_status_accepts_boolean_health_checks(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "ok",
                "checks": {
                    "ranker_loaded": True,
                    "explainer_loaded": True,
                    "feedback_ingest": True,
                },
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr("service.matchmaking.ml_facade.httpx.AsyncClient", FakeAsyncClient)

    facade = HttpMlFacade(base_url="http://ml-service:8080", service_token="test-token")

    status = await facade.connection_status()

    assert status.reachable is True
    assert status.healthy is True
    assert status.fallback_active is False
    assert status.detail is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_http_ml_facade_exposes_specific_category_reason(monkeypatch):
    category = load_category_definitions()[0]
    requester = FeedCandidateContext(
        user_id=uuid4(),
        ml_user_id="requester-ml",
        display_name="Requester",
    )
    candidate = FeedCandidateContext(
        user_id=uuid4(),
        ml_user_id="candidate-ml",
        display_name="Candidate",
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "decision_mode": "model",
                "candidates": [
                    {
                        "candidate_user_id": "candidate-ml",
                        "score": 0.91,
                        "score_components": {
                            category.key: 0.82,
                            "coffee": 0.18,
                        },
                        "reason_signals": [
                            {
                                "code": "lifestyle_similarity",
                                "strength": "high",
                                "confidence": 0.95,
                            },
                            {
                                "code": "activity_overlap",
                                "strength": "high",
                                "confidence": 0.93,
                            }
                        ],
                    }
                ],
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr("service.matchmaking.ml_facade.httpx.AsyncClient", FakeAsyncClient)

    facade = HttpMlFacade(base_url="http://ml-service:8080", service_token="test-token")
    ranked = await facade.rank(requester, [candidate], limit=1)
    preview = facade.build_preview(ranked.candidates[0])

    assert ranked.decision_mode.value == "model"
    assert preview.preview.startswith("Вы оба любите")
    assert "category_fit" in preview.reason_codes
    assert any(signal.label.startswith("Вы оба любите") for signal in preview.reason_signals)
    assert preview.category_breakdown[0].label == category.label
