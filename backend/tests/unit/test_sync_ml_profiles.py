from uuid import uuid4

import pytest

from scripts.sync_ml_profiles import BackendUserProfile, _build_favorite_categories


def _profile(
    *, email: str, ml_user_id: str, interests: list[str]
) -> BackendUserProfile:
    return BackendUserProfile(
        user_id=uuid4(),
        ml_user_id=ml_user_id,
        email=email,
        interests=interests,
    )


@pytest.mark.unit
def test_demo_food_b_uses_food_cluster_categories():
    profile = _profile(
        email="demo.food.b@tmatch.example.com",
        ml_user_id="food-b-id",
        interests=["рестораны", "фаст_фуд", "супермаркеты"],
    )

    categories = _build_favorite_categories(
        profile=profile,
        bootstrap_categories=["travel", "transport", "health"],
    )

    assert categories == [
        "супермаркеты",
        "фаст_фуд",
        "рестораны",
        "супермаркеты",
        "фаст_фуд",
    ]


@pytest.mark.unit
def test_demo_cold_uses_single_non_restaurants_category():
    profile = _profile(
        email="demo.cold@tmatch.example.com",
        ml_user_id="cold-id",
        interests=["рестораны", "развлечения", "транспорт"],
    )

    categories = _build_favorite_categories(
        profile=profile,
        bootstrap_categories=["travel", "transport", "health"],
    )

    assert categories == ["супермаркеты"]


@pytest.mark.unit
def test_non_demo_profile_keeps_source_interest_order():
    profile = _profile(
        email="user@example.com",
        ml_user_id="user-id",
        interests=["развлечения", "транспорт", "одежда_обувь"],
    )

    categories = _build_favorite_categories(
        profile=profile,
        bootstrap_categories=["travel", "transport", "health"],
    )

    assert categories[:3] == ["развлечения", "транспорт", "одежда_обувь"]
