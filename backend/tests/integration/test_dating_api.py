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
        "display_name": f"{prefix}_{suffix}",
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
        json={"file_key": data["file_key"]},
        headers=auth_header(access_token),
    )
    assert confirm.status_code == 200
    assert confirm.json()["status"] == "approved"


async def _complete_profile(
    client: AsyncClient,
    access_token: str,
    *,
    display_name: str,
    birth_date: str,
    city: str,
    gender: str,
    looking_for_genders: list[str],
    goal: str,
) -> dict:
    patch = await client.patch(
        "/api/v1/users/me",
        json={
            "display_name": display_name,
            "birth_date": birth_date,
            "city": city,
            "gender": gender,
            "bio": f"{display_name} bio",
            "search_preferences": {
                "looking_for_genders": looking_for_genders,
                "age_range": {"min": 24, "max": 36},
                "distance_km": 30,
                "goal": goal,
            },
        },
        headers=auth_header(access_token),
    )
    assert patch.status_code == 200
    await _upload_avatar(client, access_token)
    me = await client.get("/api/v1/users/me", headers=auth_header(access_token))
    assert me.status_code == 200
    return me.json()


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
async def test_optional_quiz_and_feed_match_chat_flow(client: AsyncClient, faker: Faker):
    _, access_a = await _register_user(client, faker, "alice")
    _, access_b = await _register_user(client, faker, "bob")

    locked_feed = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert locked_feed.status_code == 200
    assert locked_feed.json()["feed_state"] == "locked"
    assert locked_feed.json()["lock_reason"] == "required_fields_missing"

    onboarding_config = await client.get("/api/v1/onboarding/config", headers=auth_header(access_a))
    assert onboarding_config.status_code == 200
    assert onboarding_config.json()["steps"]

    skipped = await client.post("/api/v1/onboarding/skip", headers=auth_header(access_a))
    assert skipped.status_code == 200
    assert skipped.json()["quiz_status"] == "skipped"

    resumed = await client.post("/api/v1/onboarding/resume", headers=auth_header(access_a))
    assert resumed.status_code == 200
    assert resumed.json()["quiz_status"] == "in_progress"

    answer = await client.post(
        "/api/v1/onboarding/answers",
        json={"step_key": "weekend_vibe", "answers": ["city_walks", "live_events"]},
        headers=auth_header(access_a),
    )
    assert answer.status_code == 200
    assert answer.json()["quiz_status"] in {"in_progress", "completed"}

    profile_a = await _complete_profile(
        client,
        access_a,
        display_name="Alice",
        birth_date="1998-05-12",
        city="Moscow",
        gender="female",
        looking_for_genders=["male"],
        goal="casual_dates",
    )
    profile_b = await _complete_profile(
        client,
        access_b,
        display_name="Bob",
        birth_date="1996-03-03",
        city="Moscow",
        gender="male",
        looking_for_genders=["female"],
        goal="casual_dates",
    )
    assert profile_a["profile_status"] == "ready"
    assert profile_b["profile_status"] == "ready"
    assert profile_a["can_open_feed"] is True

    feed_a = await client.get("/api/v1/feed", headers=auth_header(access_a))
    assert feed_a.status_code == 200
    assert feed_a.json()["feed_state"] == "ready"
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
async def test_block_report_and_admin_audit_flow(client: AsyncClient, faker: Faker):
    credentials_a, access_a = await _register_user(client, faker, "admincandidate")
    _, access_b = await _register_user(client, faker, "blocked")
    _, access_c = await _register_user(client, faker, "reported")

    profile_a = await _complete_profile(
        client,
        access_a,
        display_name="Admin Candidate",
        birth_date="1997-05-12",
        city="Moscow",
        gender="female",
        looking_for_genders=["male"],
        goal="casual_dates",
    )
    profile_b = await _complete_profile(
        client,
        access_b,
        display_name="Blocked User",
        birth_date="1995-05-12",
        city="Moscow",
        gender="male",
        looking_for_genders=["female"],
        goal="casual_dates",
    )
    profile_c = await _complete_profile(
        client,
        access_c,
        display_name="Reported User",
        birth_date="1994-05-12",
        city="Moscow",
        gender="male",
        looking_for_genders=["female"],
        goal="casual_dates",
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
async def test_seeded_demo_users_can_demo_login_and_get_feed(redis_client):
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
            "/api/v1/auth/demo-login",
            json={"demo_user_id": "anna"},
            headers=_mobile_headers(),
        )
        assert login.status_code == 200
        access_token = login.json()["access_token"]
        user = login.json()["user"]
        assert user["display_name"] == "Anna"
        assert user["profile_status"] == "ready"

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
