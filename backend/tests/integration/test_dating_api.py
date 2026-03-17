import os
import sys
import asyncio
from contextlib import suppress
from uuid import uuid4

import pytest
from faker import Faker
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text


ROOT = os.path.dirname(os.path.dirname(__file__))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from core.config import clear_settings_cache, get_settings
from database.redis import close_redis, get_redis
from database.relational_db import UoW, dispose_engine, get_engine, get_session_factory
from domain.dating.category_catalog import load_category_definitions
from main import create_app
from service.media import get_media_storage_service
from service.seeding import run_registered_seeders
from service.seeding.base import SeedContext
from tests.helpers import auth_header


pytestmark = [
    pytest.mark.integration,
    pytest.mark.usefixtures("_integration_state"),
]

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc``\x00\x00\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _mobile_headers() -> dict[str, str]:
    return {"X-Client": "mobile"}


async def _register_user(
    client: AsyncClient, faker: Faker, prefix: str
) -> tuple[dict, str]:
    suffix = uuid4().hex[:8]
    password = faker.password(length=12)
    payload = {
        "email": f"{prefix}_{suffix}@example.com",
        "password": password,
    }
    response = await client.post(
        "/api/v1/auth/register", json=payload, headers=_mobile_headers()
    )
    assert response.status_code == 201
    return payload, response.json()["access_token"]


async def _upload_avatar(client: AsyncClient, access_token: str) -> None:
    presign = await client.post(
        "/api/v1/users/me/avatar/presign",
        json={"filename": "avatar.png", "content_type": "image/png"},
        headers=auth_header(access_token),
    )
    assert presign.status_code == 200
    data = presign.json()
    async with AsyncClient() as external_client:
        upload = await external_client.put(
            data["upload_url"],
            content=PNG_BYTES,
            headers={"Content-Type": "image/png"},
        )
    assert upload.status_code in {200, 204}
    confirm = await client.post(
        "/api/v1/users/me/avatar/confirm",
        json={"object_key": data["object_key"]},
        headers=auth_header(access_token),
    )
    assert confirm.status_code == 200
    assert confirm.json()["avatar_status"] == "approved"


async def _complete_profile(
    client: AsyncClient,
    access_token: str,
    *,
    display_name: str,
    birth_date: str,
    city_id: str,
    gender: str,
) -> dict:
    patch = await client.patch(
        "/api/v1/users/me",
        json={
            "city_id": city_id,
            "bio": f"{display_name} bio",
        },
        headers=auth_header(access_token),
    )
    assert patch.status_code == 200
    await _upload_avatar(client, access_token)
    me = await client.get("/api/v1/users/me", headers=auth_header(access_token))
    assert me.status_code == 200
    return me.json()


async def _answer_onboarding_filters(
    client: AsyncClient,
    access_token: str,
    *,
    genders: list[str],
    age_min: int,
    age_max: int,
    interests: list[str] | None = None,
    import_transactions: bool = True,
) -> None:
    interests = interests or [item.key for item in load_category_definitions()[:3]]
    patch = await client.patch(
        "/api/v1/users/me",
        json={"age_range": {"min": age_min, "max": age_max}},
        headers=auth_header(access_token),
    )
    assert patch.status_code == 200
    audience_answers = (
        [f"audience:{gender}" for gender in genders] if genders else ["audience:anyone"]
    )
    responses = [
        await client.post(
            "/api/v1/onboarding/answers",
            json={
                "step_key": "goal_and_audience",
                "answers": [
                    "goal:serious_relationship",
                    *audience_answers,
                ],
            },
            headers=auth_header(access_token),
        ),
        await client.post(
            "/api/v1/onboarding/answers",
            json={
                "step_key": "interests_and_bank_signal",
                "answers": interests,
                "import_transactions": import_transactions,
            },
            headers=auth_header(access_token),
        ),
        await client.post(
            "/api/v1/onboarding/answers",
            json={
                "step_key": "profile_preview",
                "answers": ["confirmed"],
            },
            headers=auth_header(access_token),
        ),
    ]
    for response in responses:
        assert response.status_code == 200


async def _promote_to_admin(user_id: str) -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                INSERT INTO user_roles (user_id, role_id)
                SELECT CAST(:user_id AS uuid), roles.id
                FROM roles
                WHERE roles.slug = 'admin'
                ON CONFLICT DO NOTHING
                """
            ),
            {"user_id": user_id},
        )
        await conn.execute(
            text(
                "UPDATE users SET auth_version = auth_version + 1 WHERE id = CAST(:user_id AS uuid)"
            ),
            {"user_id": user_id},
        )


async def _drop_today_recommendation_batches(*, user_id: str) -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                DELETE FROM recommendation_items
                WHERE batch_id IN (
                    SELECT id
                    FROM recommendation_batches
                    WHERE user_id = CAST(:user_id AS uuid)
                )
                """
            ),
            {"user_id": user_id},
        )
        await conn.execute(
            text(
                """
                DELETE FROM recommendation_batches
                WHERE user_id = CAST(:user_id AS uuid)
                """
            ),
            {"user_id": user_id},
        )


async def _pair_state_snapshot(*, user_a_id: str, user_b_id: str) -> dict | None:
    engine = get_engine()
    async with engine.begin() as conn:
        row = (
            (
                await conn.execute(
                    text(
                        """
                    SELECT status, cooldown_until, blocked_by_user_id
                    FROM pair_states
                    WHERE (
                        user_low_id = CAST(:user_a_id AS uuid)
                        AND user_high_id = CAST(:user_b_id AS uuid)
                    )
                    OR (
                        user_low_id = CAST(:user_b_id AS uuid)
                        AND user_high_id = CAST(:user_a_id AS uuid)
                    )
                    """
                    ),
                    {"user_a_id": user_a_id, "user_b_id": user_b_id},
                )
            )
            .mappings()
            .first()
        )
    return dict(row) if row else None


def _opposite_gender(gender: str) -> str:
    return "male" if gender == "female" else "female"


@pytest.mark.asyncio
async def test_onboarding_filters_and_feed_match_chat_flow(
    client: AsyncClient, faker: Faker
):
    credentials_a, access_a = await _register_user(client, faker, "alice")
    _, access_b = await _register_user(client, faker, "bob")
    _, access_c = await _register_user(client, faker, "charlie")

    initial_feed = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert initial_feed.status_code == 200
    assert initial_feed.json()["feed_state"] == "locked"
    assert initial_feed.json()["lock_reason"] == "avatar_required"

    onboarding_config = await client.get(
        "/api/v1/onboarding/config", headers=auth_header(access_a)
    )
    assert onboarding_config.status_code == 200
    steps = {step["step_key"]: step for step in onboarding_config.json()["steps"]}
    assert set(steps) == {"goal_and_audience", "interests_and_bank_signal"}
    assert steps["goal_and_audience"]["required_for_feed"] is False
    assert steps["goal_and_audience"]["step_type"] == "multi_select"
    assert steps["interests_and_bank_signal"]["min_answers"] is None
    assert steps["interests_and_bank_signal"]["import_transactions_enabled"] is True
    assert steps["interests_and_bank_signal"]["import_transactions_default"] is True
    assert steps["interests_and_bank_signal"]["import_transactions_value"] is True

    onboarding_state = await client.get(
        "/api/v1/onboarding/state", headers=auth_header(access_a)
    )
    assert onboarding_state.status_code == 200
    assert onboarding_state.json()["should_show"] is True
    assert onboarding_state.json()["current_step_key"] == "goal_and_audience"
    assert onboarding_state.json()["completed_step_keys"] == []
    assert onboarding_state.json()["missing_required_fields"] == []

    await _upload_avatar(client, access_a)

    onboarding_state_after_photo = await client.get(
        "/api/v1/onboarding/state", headers=auth_header(access_a)
    )
    assert onboarding_state_after_photo.status_code == 200
    assert (
        onboarding_state_after_photo.json()["current_step_key"] == "goal_and_audience"
    )
    assert onboarding_state_after_photo.json()["missing_required_fields"] == []

    answer = await client.post(
        "/api/v1/onboarding/answers",
        json={
            "step_key": "goal_and_audience",
            "answers": ["goal:serious_relationship", "audience:male"],
        },
        headers=auth_header(access_a),
    )
    assert answer.status_code == 200
    assert answer.json()["step_key"] == "goal_and_audience"
    assert answer.json()["quiz_started"] is True
    assert answer.json()["current_step_key"] == "interests_and_bank_signal"
    assert answer.json()["completed_step_keys"] == ["goal_and_audience"]
    assert answer.json()["should_show"] is True

    interests_answer = await client.post(
        "/api/v1/onboarding/answers",
        json={
            "step_key": "interests_and_bank_signal",
            "answers": [item.key for item in load_category_definitions()[:3]],
            "import_transactions": False,
        },
        headers=auth_header(access_a),
    )
    assert interests_answer.status_code == 200
    assert interests_answer.json()["completed"] is False
    assert interests_answer.json()["should_show"] is True
    assert interests_answer.json()["current_step_key"] == "profile_preview"

    preview_answer = await client.post(
        "/api/v1/onboarding/answers",
        json={
            "step_key": "profile_preview",
            "answers": ["confirmed"],
        },
        headers=auth_header(access_a),
    )
    assert preview_answer.status_code == 200
    assert preview_answer.json()["completed"] is True
    assert preview_answer.json()["should_show"] is False
    assert preview_answer.json()["current_step_key"] is None

    updated_onboarding_config = await client.get(
        "/api/v1/onboarding/config",
        headers=auth_header(access_a),
    )
    assert updated_onboarding_config.status_code == 200
    updated_steps = {
        step["step_key"]: step for step in updated_onboarding_config.json()["steps"]
    }
    assert (
        updated_steps["interests_and_bank_signal"]["import_transactions_value"] is False
    )

    completed_onboarding_state = await client.get(
        "/api/v1/onboarding/state", headers=auth_header(access_a)
    )
    assert completed_onboarding_state.status_code == 200
    assert completed_onboarding_state.json()["completed"] is True
    assert completed_onboarding_state.json()["should_show"] is False

    profile_a = await _complete_profile(
        client,
        access_a,
        display_name="Alice",
        birth_date="1998-05-12",
        city_id="msk",
        gender="female",
    )
    profile_b = await _complete_profile(
        client,
        access_b,
        display_name="Bob",
        birth_date="1996-03-03",
        city_id="msk",
        gender="male",
    )
    profile_c = await _complete_profile(
        client,
        access_c,
        display_name="Charlie",
        birth_date="1980-03-03",
        city_id="spb",
        gender="male",
    )

    await _answer_onboarding_filters(
        client,
        access_a,
        genders=[profile_b["gender"]],
        age_min=18,
        age_max=99,
        import_transactions=False,
    )
    await _answer_onboarding_filters(
        client,
        access_b,
        genders=[profile_a["gender"]],
        age_min=18,
        age_max=99,
    )
    await _answer_onboarding_filters(
        client,
        access_c,
        genders=[_opposite_gender(profile_a["gender"])],
        age_min=18,
        age_max=99,
    )

    me_a = await client.get("/api/v1/users/me", headers=auth_header(access_a))
    me_b = await client.get("/api/v1/users/me", headers=auth_header(access_b))
    assert me_a.status_code == 200
    assert me_b.status_code == 200
    assert me_a.json()["looking_for_genders"] == [profile_b["gender"]]
    assert me_a.json()["quiz_started"] is True
    assert me_a.json()["profile_status"] == "ready"
    assert me_b.json()["profile_status"] == "ready"
    assert me_a.json()["is_onboarded"] is True

    feed_a = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_a.status_code == 200
    assert feed_a.json()["feed_state"] == "ready"
    candidate_ids_a = {card["candidate"]["user_id"] for card in feed_a.json()["cards"]}
    assert profile_b["id"] in candidate_ids_a
    assert profile_c["id"] not in candidate_ids_a
    card_a = next(
        card
        for card in feed_a.json()["cards"]
        if card["candidate"]["user_id"] == profile_b["id"]
    )
    assert 0 <= card_a["compatibility"]["score_percent"] <= 100
    assert card_a["compatibility"]["category_breakdown"]
    assert len(card_a["compatibility"]["category_breakdown"]) <= 5
    assert all(
        {
            "category_key",
            "label",
            "score_percent",
        }.issubset(entry.keys())
        for entry in card_a["compatibility"]["category_breakdown"]
    )

    explanation = await client.get(
        f"/api/v1/feed/items/{card_a['serve_item_id']}/explanation",
        headers=auth_header(access_a),
    )
    assert explanation.status_code == 200
    assert explanation.json()["privacy_level"] == "safe_aggregate"
    assert explanation.json()["reasons"]

    like_a = await client.post(
        f"/api/v1/feed/items/{card_a['serve_item_id']}/reaction",
        json={"action": "like", "opened_explanation": True, "dwell_time_ms": 1500},
        headers=auth_header(access_a),
    )
    assert like_a.status_code == 200
    assert like_a.json()["result"] == "liked"

    like_a_duplicate = await client.post(
        f"/api/v1/feed/items/{card_a['serve_item_id']}/reaction",
        json={"action": "like"},
        headers=auth_header(access_a),
    )
    assert like_a_duplicate.status_code == 200
    assert like_a_duplicate.json()["result"] == "liked"

    feed_b = await client.get("/api/v1/feed", headers=auth_header(access_b))
    assert feed_b.status_code == 200
    assert feed_b.json()["feed_state"] == "ready"
    card_b = next(
        card
        for card in feed_b.json()["cards"]
        if card["candidate"]["user_id"] == profile_a["id"]
    )

    like_b = await client.post(
        f"/api/v1/feed/items/{card_b['serve_item_id']}/reaction",
        json={"action": "like", "opened_profile": True},
        headers=auth_header(access_b),
    )
    assert like_b.status_code == 200
    assert like_b.json()["result"] == "matched"
    match = like_b.json()["match"]
    assert match["match_id"]
    assert match["conversation_id"]

    realtime_token = await client.get(
        "/api/v1/realtime/connection-token",
        headers=auth_header(access_a),
    )
    assert realtime_token.status_code == 200
    assert realtime_token.json()["enabled"] is True
    assert realtime_token.json()["token"]
    assert realtime_token.json()["channels"]
    assert realtime_token.json()["ws_url"]

    notifications_a = await client.get(
        "/api/v1/notifications/matches",
        params={"unseen_only": "true"},
        headers=auth_header(access_a),
    )
    assert notifications_a.status_code == 200
    assert notifications_a.json()["unseen_count"] == 1
    assert notifications_a.json()["items"][0]["match_id"] == match["match_id"]
    assert (
        notifications_a.json()["items"][0]["conversation_id"]
        == match["conversation_id"]
    )
    assert notifications_a.json()["items"][0]["peer"]["user_id"] == profile_b["id"]

    notifications_b = await client.get(
        "/api/v1/notifications/matches",
        params={"unseen_only": "true"},
        headers=auth_header(access_b),
    )
    assert notifications_b.status_code == 200
    assert notifications_b.json()["unseen_count"] == 0

    mark_seen = await client.post(
        f"/api/v1/notifications/matches/{notifications_a.json()['items'][0]['notification_id']}/seen",
        headers=auth_header(access_a),
    )
    assert mark_seen.status_code == 200

    notifications_seen = await client.get(
        "/api/v1/notifications/matches",
        params={"unseen_only": "true"},
        headers=auth_header(access_a),
    )
    assert notifications_seen.status_code == 200
    assert notifications_seen.json()["unseen_count"] == 0

    matches_a = await client.get("/api/v1/matches", headers=auth_header(access_a))
    assert matches_a.status_code == 200
    assert matches_a.json()["items"][0]["status"] == "active"

    conversation = await client.get(
        f"/api/v1/conversations/{match['conversation_id']}",
        headers=auth_header(access_a),
    )
    assert conversation.status_code == 200
    assert conversation.json()["status"] == "active"

    conversation_realtime = await client.get(
        f"/api/v1/conversations/{match['conversation_id']}/realtime-token",
        headers=auth_header(access_a),
    )
    assert conversation_realtime.status_code == 200
    assert conversation_realtime.json()["enabled"] is True
    assert conversation_realtime.json()["token"]
    assert (
        conversation_realtime.json()["channel"]
        == f"conversation-{match['conversation_id']}"
    )

    icebreakers = await client.get(
        f"/api/v1/conversations/{match['conversation_id']}/icebreakers",
        headers=auth_header(access_a),
    )
    assert icebreakers.status_code == 200
    assert icebreakers.json()["items"]

    sent_icebreaker = await client.post(
        f"/api/v1/conversations/{match['conversation_id']}/icebreakers/{icebreakers.json()['items'][0]['icebreaker_id']}/send",
        headers=auth_header(access_a),
    )
    assert sent_icebreaker.status_code == 201
    assert sent_icebreaker.json()["status"] == "sent"

    message = await client.post(
        f"/api/v1/conversations/{match['conversation_id']}/messages",
        json={"text": "How is your day going?"},
        headers=auth_header(access_a),
    )
    assert message.status_code == 201
    assert message.json()["status"] == "sent"

    messages = await client.get(
        f"/api/v1/conversations/{match['conversation_id']}/messages",
        headers=auth_header(access_b),
    )
    assert messages.status_code == 200
    assert len(messages.json()["items"]) >= 2

    reply = await client.post(
        f"/api/v1/conversations/{match['conversation_id']}/messages",
        json={"text": "Doing well, thanks!"},
        headers=auth_header(access_b),
    )
    assert reply.status_code == 201
    assert reply.json()["status"] == "sent"

    close_match = await client.post(
        f"/api/v1/matches/{match['match_id']}/close",
        json={"reason_code": "not_interested"},
        headers=auth_header(access_a),
    )
    assert close_match.status_code == 200
    assert close_match.json()["status"] == "closed"
    assert close_match.json()["removed_from_future_feed"] is True

    message_after_close = await client.post(
        f"/api/v1/conversations/{match['conversation_id']}/messages",
        json={"text": "This should fail"},
        headers=auth_header(access_a),
    )
    assert message_after_close.status_code == 409

    await _promote_to_admin(profile_a["id"])
    relogin = await client.post(
        "/api/v1/auth/login",
        json={"email": credentials_a["email"], "password": credentials_a["password"]},
        headers=_mobile_headers(),
    )
    assert relogin.status_code == 200
    admin_access = relogin.json()["access_token"]

    funnel_summary = await client.get(
        "/api/v1/admins/stats/funnel/summary",
        headers=auth_header(admin_access),
    )
    assert funnel_summary.status_code == 200
    summary_json = funnel_summary.json()
    assert summary_json["totals"]["feed_served"] >= 2
    assert summary_json["totals"]["feed_explanation_opened"] >= 1
    assert summary_json["totals"]["feed_like"] >= 2
    assert summary_json["totals"]["match_created"] == 1
    assert summary_json["totals"]["chat_first_message_sent"] == 1
    assert summary_json["totals"]["chat_first_reply_received"] == 1
    assert summary_json["totals"]["match_closed"] == 1
    assert any(
        segment["user_source"] == "cold_start"
        for segment in summary_json["by_user_source"]
    )
    assert any(
        segment["decision_mode"] in {"model", "fallback", "unknown"}
        for segment in summary_json["by_decision_mode"]
    )

    funnel_daily = await client.get(
        "/api/v1/admins/stats/funnel/daily",
        params={"days": 7},
        headers=auth_header(admin_access),
    )
    assert funnel_daily.status_code == 200
    assert funnel_daily.json()

    engine = get_engine()
    async with engine.begin() as conn:
        outbox_topics = (
            (
                await conn.execute(
                    text(
                        """
                    SELECT topic
                    FROM outbox_events
                    WHERE topic = 'ml.interactions.match_outcome'
                    ORDER BY created_at ASC
                    """
                    )
                )
            )
            .scalars()
            .all()
        )
    assert outbox_topics


@pytest.mark.asyncio
async def test_pass_action_prevents_repeat_after_batch_regeneration(
    client: AsyncClient, faker: Faker
):
    _, access_a = await _register_user(client, faker, "pass_norepeat_a")
    _, access_b = await _register_user(client, faker, "pass_norepeat_b")

    profile_a = await _complete_profile(
        client,
        access_a,
        display_name="Pass NoRepeat A",
        birth_date="1997-05-12",
        city_id="msk",
        gender="female",
    )
    profile_b = await _complete_profile(
        client,
        access_b,
        display_name="Pass NoRepeat B",
        birth_date="1996-05-12",
        city_id="msk",
        gender="male",
    )

    await _answer_onboarding_filters(
        client, access_a, genders=[profile_b["gender"]], age_min=18, age_max=99
    )
    await _answer_onboarding_filters(
        client, access_b, genders=[profile_a["gender"]], age_min=18, age_max=99
    )

    feed_before = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_before.status_code == 200
    assert feed_before.json()["feed_state"] == "ready"

    card_b = next(
        card
        for card in feed_before.json()["cards"]
        if card["candidate"]["user_id"] == profile_b["id"]
    )
    reaction = await client.post(
        f"/api/v1/feed/items/{card_b['serve_item_id']}/reaction",
        json={"action": "pass"},
        headers=auth_header(access_a),
    )
    assert reaction.status_code == 200
    assert reaction.json()["result"] == "passed"

    await _drop_today_recommendation_batches(user_id=profile_a["id"])

    feed_after = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_after.status_code == 200
    ids_after = {card["candidate"]["user_id"] for card in feed_after.json()["cards"]}
    assert profile_b["id"] not in ids_after

    pair_state = await _pair_state_snapshot(
        user_a_id=profile_a["id"], user_b_id=profile_b["id"]
    )
    assert pair_state is not None
    assert pair_state["status"] == "closed"
    assert pair_state["cooldown_until"] is not None


@pytest.mark.asyncio
async def test_unblock_keeps_candidate_excluded_until_cooldown(
    client: AsyncClient, faker: Faker
):
    _, access_a = await _register_user(client, faker, "unblock_cooldown_a")
    _, access_b = await _register_user(client, faker, "unblock_cooldown_b")

    profile_a = await _complete_profile(
        client,
        access_a,
        display_name="Unblock Cooldown A",
        birth_date="1997-05-12",
        city_id="msk",
        gender="female",
    )
    profile_b = await _complete_profile(
        client,
        access_b,
        display_name="Unblock Cooldown B",
        birth_date="1996-05-12",
        city_id="msk",
        gender="male",
    )

    await _answer_onboarding_filters(
        client, access_a, genders=[profile_b["gender"]], age_min=18, age_max=99
    )
    await _answer_onboarding_filters(
        client, access_b, genders=[profile_a["gender"]], age_min=18, age_max=99
    )

    feed_before = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_before.status_code == 200
    assert any(
        card["candidate"]["user_id"] == profile_b["id"]
        for card in feed_before.json()["cards"]
    )

    block = await client.post(
        "/api/v1/blocks",
        json={
            "target_user_id": profile_b["id"],
            "source_context": "feed",
            "reason_code": "harassment",
        },
        headers=auth_header(access_a),
    )
    assert block.status_code == 200
    assert block.json()["status"] == "blocked"

    unblock = await client.delete(
        f"/api/v1/blocks/{profile_b['id']}",
        headers=auth_header(access_a),
    )
    assert unblock.status_code == 200
    assert unblock.json()["status"] == "unblocked"
    assert unblock.json()["removed_from_blocklist"] is True

    blocked_list = await client.get("/api/v1/blocks", headers=auth_header(access_a))
    assert blocked_list.status_code == 200
    assert profile_b["id"] not in {
        item["target_user_id"] for item in blocked_list.json()["items"]
    }

    await _drop_today_recommendation_batches(user_id=profile_a["id"])

    feed_after = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_after.status_code == 200
    ids_after = {card["candidate"]["user_id"] for card in feed_after.json()["cards"]}
    assert profile_b["id"] not in ids_after

    pair_state = await _pair_state_snapshot(
        user_a_id=profile_a["id"], user_b_id=profile_b["id"]
    )
    assert pair_state is not None
    assert pair_state["status"] == "closed"
    assert pair_state["cooldown_until"] is not None
    assert pair_state["blocked_by_user_id"] is None


@pytest.mark.asyncio
async def test_onboarding_accepts_equal_age_range_bounds(
    client: AsyncClient, faker: Faker
):
    _, access = await _register_user(client, faker, "equalage")

    patch = await client.patch(
        "/api/v1/users/me",
        json={
            "age_range": {"min": 18, "max": 18},
        },
        headers=auth_header(access),
    )
    assert patch.status_code == 200

    me = await client.get("/api/v1/users/me", headers=auth_header(access))
    assert me.status_code == 200
    assert me.json()["age_range"] == {"min": 18, "max": 18}


@pytest.mark.asyncio
async def test_onboarding_skip_persists_and_hides_quiz(
    client: AsyncClient, faker: Faker
):
    _, access_token = await _register_user(client, faker, "skipper")

    initial_state = await client.get(
        "/api/v1/onboarding/state", headers=auth_header(access_token)
    )
    assert initial_state.status_code == 200
    assert initial_state.json()["should_show"] is True
    assert initial_state.json()["current_step_key"] == "goal_and_audience"

    skip_response = await client.post(
        "/api/v1/onboarding/skip", headers=auth_header(access_token)
    )
    assert skip_response.status_code == 200
    assert skip_response.json()["quiz_started"] is True
    assert skip_response.json()["skipped"] is True
    assert skip_response.json()["should_show"] is False
    assert skip_response.json()["current_step_key"] is None

    refreshed_state = await client.get(
        "/api/v1/onboarding/state", headers=auth_header(access_token)
    )
    assert refreshed_state.status_code == 200
    assert refreshed_state.json()["skipped"] is True
    assert refreshed_state.json()["should_show"] is False
    assert refreshed_state.json()["current_step_key"] is None


@pytest.mark.asyncio
async def test_profile_patch_keeps_preferences_as_source_of_truth(
    client: AsyncClient, faker: Faker
):
    _, access_token = await _register_user(client, faker, "profileprefs")

    await _complete_profile(
        client,
        access_token,
        display_name="Profile Source",
        birth_date="1996-05-12",
        city_id="msk",
        gender="female",
    )
    await _answer_onboarding_filters(
        client,
        access_token,
        genders=["male"],
        age_min=24,
        age_max=36,
        import_transactions=False,
    )

    patch = await client.patch(
        "/api/v1/users/me",
        json={
            "looking_for_genders": [],
            "age_range": None,
            "interests": [],
            "import_transactions": True,
        },
        headers=auth_header(access_token),
    )
    assert patch.status_code == 200
    assert patch.json()["looking_for_genders"] == []
    assert patch.json()["age_range"] is None
    assert patch.json()["interests"] == []
    assert patch.json()["import_transactions"] is True

    state = await client.get(
        "/api/v1/onboarding/state", headers=auth_header(access_token)
    )
    assert state.status_code == 200
    assert state.json()["answers_by_step"]["goal_and_audience"] == [
        "goal:serious_relationship",
        "audience:anyone",
    ]
    assert state.json()["answers_by_step"]["interests_and_bank_signal"] == []
    assert set(state.json()["completed_step_keys"]) == {
        "goal_and_audience",
        "interests_and_bank_signal",
        "profile_preview",
    }

    config = await client.get(
        "/api/v1/onboarding/config", headers=auth_header(access_token)
    )
    assert config.status_code == 200
    steps = {step["step_key"]: step for step in config.json()["steps"]}
    assert steps["interests_and_bank_signal"]["import_transactions_value"] is True


@pytest.mark.asyncio
async def test_block_report_and_admin_audit_flow(client: AsyncClient, faker: Faker):
    credentials_a, access_a = await _register_user(client, faker, "admincandidate")
    _, access_b = await _register_user(client, faker, "blocked")
    _, access_c = await _register_user(client, faker, "reported")

    profile_a = await _complete_profile(
        client,
        access_a,
        display_name="Admin Candidate",
        birth_date="1997-05-12",
        city_id="msk",
        gender="female",
    )
    profile_b = await _complete_profile(
        client,
        access_b,
        display_name="Blocked User",
        birth_date="1995-05-12",
        city_id="msk",
        gender="male",
    )
    profile_c = await _complete_profile(
        client,
        access_c,
        display_name="Reported User",
        birth_date="1994-05-12",
        city_id="msk",
        gender="male",
    )

    await _answer_onboarding_filters(
        client, access_a, genders=["male"], age_min=24, age_max=36
    )
    await _answer_onboarding_filters(
        client, access_b, genders=["female"], age_min=24, age_max=36
    )
    await _answer_onboarding_filters(
        client, access_c, genders=["female"], age_min=24, age_max=36
    )

    block = await client.post(
        "/api/v1/blocks",
        json={
            "target_user_id": profile_b["id"],
            "source_context": "feed",
            "reason_code": "harassment",
        },
        headers=auth_header(access_a),
    )
    assert block.status_code == 200
    assert block.json()["status"] == "blocked"

    report = await client.post(
        "/api/v1/reports",
        json={
            "target_user_id": profile_c["id"],
            "source_context": "feed",
            "category": "spam",
            "description": "Suspicious profile",
            "also_block": True,
        },
        headers=auth_header(access_a),
    )
    assert report.status_code == 200
    assert report.json()["also_block_applied"] is True

    blocked_before = await client.get("/api/v1/blocks", headers=auth_header(access_a))
    assert blocked_before.status_code == 200
    blocked_target_ids = {
        item["target_user_id"] for item in blocked_before.json()["items"]
    }
    assert profile_b["id"] in blocked_target_ids
    assert profile_c["id"] in blocked_target_ids

    unblock = await client.delete(
        f"/api/v1/blocks/{profile_b['id']}",
        headers=auth_header(access_a),
    )
    assert unblock.status_code == 200
    assert unblock.json()["status"] == "unblocked"
    assert unblock.json()["removed_from_blocklist"] is True

    blocked_after = await client.get("/api/v1/blocks", headers=auth_header(access_a))
    assert blocked_after.status_code == 200
    blocked_after_ids = {
        item["target_user_id"] for item in blocked_after.json()["items"]
    }
    assert profile_b["id"] not in blocked_after_ids
    assert profile_c["id"] in blocked_after_ids

    feed_after_safety = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_after_safety.status_code == 200
    target_ids = {
        card["candidate"]["user_id"] for card in feed_after_safety.json()["cards"]
    }
    assert profile_b["id"] not in target_ids
    assert profile_c["id"] not in target_ids

    audit_forbidden = await client.get(
        "/api/v1/audit/events",
        params={"entity_type": "report", "entity_id": report.json()["report_id"]},
        headers=auth_header(access_a),
    )
    assert audit_forbidden.status_code == 403

    await _promote_to_admin(profile_a["id"])
    relogin = await client.post(
        "/api/v1/auth/login",
        json={"email": credentials_a["email"], "password": credentials_a["password"]},
        headers=_mobile_headers(),
    )
    assert relogin.status_code == 200
    admin_access = relogin.json()["access_token"]

    audit_ok = await client.get(
        "/api/v1/audit/events",
        params={"entity_type": "report", "entity_id": report.json()["report_id"]},
        headers=auth_header(admin_access),
    )
    assert audit_ok.status_code == 200
    assert any(
        item["event_type"] == "user_reported" for item in audit_ok.json()["items"]
    )

    moderation_summary = await client.get(
        "/api/v1/admins/moderation/reports/summary",
        headers=auth_header(admin_access),
    )
    assert moderation_summary.status_code == 200
    assert moderation_summary.json()["pending_reports"] >= 1

    moderation_reports = await client.get(
        "/api/v1/admins/moderation/reports/",
        headers=auth_header(admin_access),
        params={"status": "pending"},
    )
    assert moderation_reports.status_code == 200
    pending_report = next(
        item
        for item in moderation_reports.json()["items"]
        if item["id"] == report.json()["report_id"]
    )
    assert pending_report["target"]["id"] == profile_c["id"]
    assert pending_report["review_status"] == "pending"

    review = await client.post(
        f"/api/v1/admins/moderation/reports/{report.json()['report_id']}/review",
        headers=auth_header(admin_access),
        json={
            "status": "resolved",
            "review_note": "Confirmed during moderation",
            "ban_user": True,
        },
    )
    assert review.status_code == 200
    assert review.json()["report"]["review_status"] == "resolved"
    assert review.json()["report"]["review_action"] == "banned"
    assert review.json()["report"]["reviewer"]["id"] == profile_a["id"]

    banned_users = await client.get(
        "/api/v1/admins/users/",
        headers=auth_header(admin_access),
        params={"banned": True, "limit": 50},
    )
    assert banned_users.status_code == 200
    assert any(item["id"] == profile_c["id"] for item in banned_users.json()["items"])


@pytest.mark.asyncio
async def test_seeded_demo_users_can_login_and_get_feed(redis_client):
    os.environ["MOCK_USER_SEED_ENABLED"] = "true"
    clear_settings_cache()
    storage = get_media_storage_service()
    await asyncio.to_thread(storage.ensure_buckets)
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with UoW(session) as uow:
            await run_registered_seeders(
                SeedContext(
                    settings=get_settings(),
                    uow=uow,
                    storage=storage,
                )
            )
    application = create_app(
        enable_rate_limiter=False, check_db_on_startup=False, enable_scheduler=False
    )
    application.dependency_overrides[get_redis] = lambda: redis_client
    transport = ASGITransport(app=application)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as seeded_client:
        login = await seeded_client.post(
            "/api/v1/auth/login",
            json={"email": "demo.food.a@tmatch.example.com", "password": "DemoPass123!"},
            headers=_mobile_headers(),
        )
        assert login.status_code == 200
        access_token = login.json()["access_token"]

        feed = await seeded_client.get(
            "/api/v1/feed", headers=auth_header(access_token)
        )
        assert feed.status_code == 200
        assert feed.json()["feed_state"] == "ready"
        assert feed.json()["cards"]

    application.dependency_overrides.clear()
    with suppress(RuntimeError):
        await close_redis()
    await dispose_engine()
    os.environ["DEV_SEED_ENABLED"] = "false"
    clear_settings_cache()


@pytest.mark.asyncio
async def test_seeded_dataset_and_cold_start_segments_are_visible_in_funnel(
    redis_client, faker: Faker
):
    os.environ["MOCK_USER_SEED_ENABLED"] = "true"
    clear_settings_cache()
    storage = get_media_storage_service()
    await asyncio.to_thread(storage.ensure_buckets)
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with UoW(session) as uow:
            await run_registered_seeders(
                SeedContext(
                    settings=get_settings(),
                    uow=uow,
                    storage=storage,
                )
            )
    application = create_app(
        enable_rate_limiter=False, check_db_on_startup=False, enable_scheduler=False
    )
    application.dependency_overrides[get_redis] = lambda: redis_client
    transport = ASGITransport(app=application)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as seeded_client:
        dataset_login = await seeded_client.post(
            "/api/v1/auth/login",
            json={"email": "demo.food.a@tmatch.example.com", "password": "DemoPass123!"},
            headers=_mobile_headers(),
        )
        assert dataset_login.status_code == 200
        dataset_access = dataset_login.json()["access_token"]

        cold_credentials, cold_access = await _register_user(
            seeded_client, faker, "segmentcold"
        )
        cold_profile = await _complete_profile(
            seeded_client,
            cold_access,
            display_name="Segment Cold",
            birth_date="1997-06-12",
            city_id="msk",
            gender="female",
        )
        await _answer_onboarding_filters(
            seeded_client,
            cold_access,
            genders=["male"],
            age_min=18,
            age_max=99,
        )

        dataset_feed = await seeded_client.get(
            "/api/v1/feed", headers=auth_header(dataset_access)
        )
        cold_feed = await seeded_client.get(
            "/api/v1/feed", headers=auth_header(cold_access)
        )
        assert dataset_feed.status_code == 200
        assert cold_feed.status_code == 200

        await _promote_to_admin(cold_profile["id"])
        relogin = await seeded_client.post(
            "/api/v1/auth/login",
            json={
                "email": cold_credentials["email"],
                "password": cold_credentials["password"],
            },
            headers=_mobile_headers(),
        )
        assert relogin.status_code == 200
        admin_access = relogin.json()["access_token"]

        summary = await seeded_client.get(
            "/api/v1/admins/stats/funnel/summary",
            headers=auth_header(admin_access),
        )
        assert summary.status_code == 200
        by_source = {
            item["user_source"]: item for item in summary.json()["by_user_source"]
        }
        assert by_source["dataset"]["counts"]["feed_served"] >= 1
        assert by_source["cold_start"]["counts"]["feed_served"] >= 1

    application.dependency_overrides.clear()
    with suppress(RuntimeError):
        await close_redis()
    await dispose_engine()
    os.environ["DEV_SEED_ENABLED"] = "false"
    clear_settings_cache()
