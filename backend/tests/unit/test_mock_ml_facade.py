from datetime import date
from uuid import uuid4

import pytest

from domain.dating import AgeRange, FeedCandidateContext
from service.dating.ml_facade import MockMlFacade


@pytest.mark.unit
@pytest.mark.asyncio
async def test_mock_ml_facade_prefers_better_matching_candidate():
    facade = MockMlFacade()
    requester = FeedCandidateContext(
        user_id=uuid4(),
        display_name="Anna",
        birth_date=date(1998, 5, 12),
        city_id="msk",
        city_name="Moscow",
        bio="Coffee and theater",
        gender="female",
        looking_for_genders=["male"],
        age_range=AgeRange(min=25, max=35),
        distance_km=30,
        goal="dating",
        avatar_url="https://example.com/a.png",
    )
    strong = FeedCandidateContext(
        user_id=uuid4(),
        display_name="Dima",
        birth_date=date(1995, 7, 1),
        city_id="msk",
        city_name="Moscow",
        bio="Theater and sport",
        gender="male",
        looking_for_genders=["female"],
        age_range=AgeRange(min=24, max=33),
        distance_km=30,
        goal="dating",
        avatar_url="https://example.com/b.png",
    )
    weak = FeedCandidateContext(
        user_id=uuid4(),
        display_name="Roma",
        birth_date=date(1990, 1, 1),
        city_id="spb",
        city_name="Saint Petersburg",
        bio=None,
        gender="male",
        looking_for_genders=["female"],
        age_range=AgeRange(min=30, max=40),
        distance_km=30,
        goal="friendship",
        avatar_url="https://example.com/c.png",
    )

    ranked = await facade.rank(type("Payload", (), {"requester": requester, "candidates": [weak, strong], "limit": 2})())

    assert ranked.decision_mode.value == "fallback"
    assert ranked.candidates[0].candidate_user_id == strong.user_id
    assert ranked.candidates[0].score > ranked.candidates[1].score
