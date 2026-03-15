import os
import sys
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
from main import create_app
from service.dev_seed import ensure_dev_seed
from service.media import get_media_storage_service
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


async def _register_user(client: AsyncClient, faker: Faker, prefix: str) -> tuple[dict, str]:
    suffix = uuid4().hex[:8]
    password = faker.password(length=12)
    payload = {
        "email": f"{prefix}_{suffix}@example.com",
        "password": password,
        "username": f"{prefix}_{suffix}",
    }
    response = await client.post("/api/v1/auth/register", json=payload, headers=_mobile_headers())
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
            "display_name": display_name,
            "birth_date": birth_date,
            "city_id": city_id,
            "gender": gender,
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
    goal: str,
    radius_km: int = 30,
) -> None:
    responses = [
        await client.post(
            "/api/v1/onboarding/answers",
            json={"step_key": "who_to_meet", "answers": genders},
            headers=auth_header(access_token),
        ),
        await client.post(
            "/api/v1/onboarding/answers",
            json={"step_key": "preferred_age_range", "answers": [str(age_min), str(age_max)]},
            headers=auth_header(access_token),
        ),
        await client.post(
            "/api/v1/onboarding/answers",
            json={"step_key": "connection_goal", "answers": [goal]},
            headers=auth_header(access_token),
        ),
        await client.post(
            "/api/v1/onboarding/answers",
            json={"step_key": "search_radius", "answers": [str(radius_km)]},
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
            text("UPDATE users SET auth_version = auth_version + 1 WHERE id = CAST(:user_id AS uuid)"),
            {"user_id": user_id},
        )


@pytest.mark.asyncio
async def test_onboarding_filters_and_feed_match_chat_flow(client: AsyncClient, faker: Faker):
    _, access_a = await _register_user(client, faker, "alice")
    _, access_b = await _register_user(client, faker, "bob")
    _, access_c = await _register_user(client, faker, "charlie")

    locked_feed = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert locked_feed.status_code == 200
    assert locked_feed.json()["feed_state"] == "locked"
    assert locked_feed.json()["lock_reason"] == "avatar_required"

    onboarding_config = await client.get("/api/v1/onboarding/config", headers=auth_header(access_a))
    assert onboarding_config.status_code == 200
    steps = {step["step_key"]: step for step in onboarding_config.json()["steps"]}
    assert set(steps) == {"who_to_meet", "preferred_age_range", "connection_goal", "search_radius"}
    assert steps["who_to_meet"]["required_for_feed"] is False
    assert steps["preferred_age_range"]["step_type"] == "range"
    assert steps["search_radius"]["required_for_feed"] is False

    answer = await client.post(
        "/api/v1/onboarding/answers",
        json={"step_key": "who_to_meet", "answers": ["male"]},
        headers=auth_header(access_a),
    )
    assert answer.status_code == 200
    assert answer.json() == {"step_key": "who_to_meet", "saved": True, "quiz_started": True}

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
        genders=["male"],
        age_min=24,
        age_max=36,
        goal="casual_dates",
        radius_km=30,
    )
    await _answer_onboarding_filters(
        client,
        access_b,
        genders=["female"],
        age_min=24,
        age_max=36,
        goal="casual_dates",
        radius_km=30,
    )
    await _answer_onboarding_filters(
        client,
        access_c,
        genders=["female"],
        age_min=21,
        age_max=29,
        goal="serious_relationship",
        radius_km=30,
    )

    me_a = await client.get("/api/v1/users/me", headers=auth_header(access_a))
    me_b = await client.get("/api/v1/users/me", headers=auth_header(access_b))
    assert me_a.status_code == 200
    assert me_b.status_code == 200
    assert me_a.json()["goal"] == "dating"
    assert me_a.json()["looking_for_genders"] == ["male"]
    assert me_a.json()["quiz_started"] is True
    assert me_a.json()["profile_status"] == "active"
    assert me_b.json()["profile_status"] == "active"
    assert me_a.json()["is_onboarded"] is True

    feed_a = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_a.status_code == 200
    assert feed_a.json()["feed_state"] == "ready"
    candidate_ids_a = {card["candidate"]["user_id"] for card in feed_a.json()["cards"]}
    assert profile_b["id"] in candidate_ids_a
    assert profile_c["id"] not in candidate_ids_a
    card_a = next(card for card in feed_a.json()["cards"] if card["candidate"]["user_id"] == profile_b["id"])

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
    card_b = next(card for card in feed_b.json()["cards"] if card["candidate"]["user_id"] == profile_a["id"])

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
    assert notifications_a.json()["items"][0]["conversation_id"] == match["conversation_id"]
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


@pytest.mark.asyncio
async def test_onboarding_accepts_equal_age_range_bounds(client: AsyncClient, faker: Faker):
    _, access = await _register_user(client, faker, "equalage")

    answer = await client.post(
        "/api/v1/onboarding/answers",
        json={"step_key": "preferred_age_range", "answers": ["18", "18"]},
        headers=auth_header(access),
    )
    assert answer.status_code == 200
    assert answer.json() == {
        "step_key": "preferred_age_range",
        "saved": True,
        "quiz_started": True,
    }

    me = await client.get("/api/v1/users/me", headers=auth_header(access))
    assert me.status_code == 200
    assert me.json()["age_range"] == {"min": 18, "max": 18}


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

    await _answer_onboarding_filters(client, access_a, genders=["male"], age_min=24, age_max=36, goal="casual_dates")
    await _answer_onboarding_filters(client, access_b, genders=["female"], age_min=24, age_max=36, goal="casual_dates")
    await _answer_onboarding_filters(client, access_c, genders=["female"], age_min=24, age_max=36, goal="casual_dates")

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

    feed_after_safety = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_after_safety.status_code == 200
    target_ids = {card["candidate"]["user_id"] for card in feed_after_safety.json()["cards"]}
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
    assert any(item["event_type"] == "user_reported" for item in audit_ok.json()["items"])


@pytest.mark.asyncio
async def test_seeded_demo_users_can_login_and_get_feed(redis_client):
    os.environ["DEV_SEED_ENABLED"] = "true"
    clear_settings_cache()
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with UoW(session) as uow:
            await ensure_dev_seed(
                uow=uow,
                storage=get_media_storage_service(),
                settings=get_settings(),
            )
    application = create_app(enable_rate_limiter=False, check_db_on_startup=False, enable_scheduler=False)
    application.dependency_overrides[get_redis] = lambda: redis_client
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://testserver") as seeded_client:
        login = await seeded_client.post(
            "/api/v1/auth/login",
            json={"email": "anna.demo@example.com", "password": "DemoPass123!"},
            headers=_mobile_headers(),
        )
        assert login.status_code == 200
        access_token = login.json()["access_token"]

        feed = await seeded_client.get("/api/v1/feed", headers=auth_header(access_token))
        assert feed.status_code == 200
        assert feed.json()["feed_state"] == "ready"
        assert feed.json()["cards"]

    application.dependency_overrides.clear()
    with suppress(RuntimeError):
        await close_redis()
    await dispose_engine()
    os.environ["DEV_SEED_ENABLED"] = "false"
    clear_settings_cache()
