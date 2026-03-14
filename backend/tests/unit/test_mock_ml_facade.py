from datetime import date
from uuid import uuid4

import pytest

from domain.dating import AgeRange, FeedCandidateContext, SearchPreferences
from service.matchmaking.ml_facade import MockMlFacade


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
