from __future__ import annotations

import argparse
import asyncio
import hashlib
import math
import random
from collections import Counter
from dataclasses import dataclass
from typing import Any
from uuid import NAMESPACE_DNS, UUID, uuid4, uuid5

import httpx
from sqlalchemy import select

from core.config import get_settings
from database.relational_db import User, get_session_factory
from service.mock_identity import get_mock_identity_registry


DEFAULT_COLLECTION = "user_profiles"
DEFAULT_QDRANT_URL = "http://qdrant:6333"
DEFAULT_FAVORITE_CATEGORIES = ("grocery", "cafe", "transport", "travel", "health")
_SCENARIO_ONLY_CATEGORIES_BY_EMAIL: dict[str, tuple[str, ...]] = {
    "demo.food.b@tmatch.example.com": ("одежда_обувь",),
    "demo.cold@tmatch.example.com": ("супермаркеты",),
}


@dataclass(slots=True)
class BackendUserProfile:
    user_id: UUID
    ml_user_id: str
    email: str
    interests: list[str]


@dataclass(slots=True)
class QdrantSnapshot:
    points_count: int
    normalized_party_ids: set[str]
    orphan_point_ids: list[Any]
    suggested_categories: list[str]


def _normalize_ml_user_id(raw: object) -> str:
    return str(raw).strip().lower()


def _parse_categories(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item and item.strip()]


def _stable_seed(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def _point_id_for_ml_user_id(ml_user_id: str) -> str:
    return str(uuid5(NAMESPACE_DNS, _normalize_ml_user_id(ml_user_id)))


def _build_favorite_categories(
    *,
    profile: BackendUserProfile,
    bootstrap_categories: list[str],
) -> list[str]:
    normalized_email = (profile.email or "").strip().lower()
    scenario_categories = _SCENARIO_ONLY_CATEGORIES_BY_EMAIL.get(normalized_email)
    if scenario_categories:
        return list(scenario_categories)

    picked: list[str] = []

    for raw_interest in profile.interests:
        candidate = str(raw_interest).strip()
        if not candidate:
            continue
        # Keep source ordering (including duplicates) to preserve preference intensity.
        picked.append(candidate)
        if len(picked) >= 5:
            return picked[:5]

    seen = {item.lower() for item in picked}

    if bootstrap_categories:
        seed = _stable_seed(profile.ml_user_id)
        start = seed % len(bootstrap_categories)
        ordered_bootstrap = bootstrap_categories[start:] + bootstrap_categories[:start]
    else:
        ordered_bootstrap = list(DEFAULT_FAVORITE_CATEGORIES)

    for category in ordered_bootstrap:
        normalized = category.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        picked.append(category)
        if len(picked) >= 5:
            break

    return picked[:5] if picked else list(DEFAULT_FAVORITE_CATEGORIES[:3])


def _preferred_hour(ml_user_id: str) -> float:
    return float(_stable_seed(ml_user_id) % 24)


def _fallback_vector(profile: BackendUserProfile, *, size: int) -> list[float]:
    seed = _stable_seed(profile.ml_user_id)
    rng = random.Random(seed)
    vector = [rng.uniform(-0.05, 0.05) for _ in range(size)]

    for rank, raw_interest in enumerate(profile.interests[:5], start=1):
        index = _stable_seed(raw_interest.lower()) % size
        vector[index] += 1.0 / rank

    vector[-1] += (_preferred_hour(profile.ml_user_id) - 12.0) / 12.0
    norm = math.sqrt(sum(value * value for value in vector))
    if norm <= 1e-12:
        return [0.0] * size
    return [float(value / norm) for value in vector]


async def _ensure_ml_user_ids() -> tuple[list[BackendUserProfile], int]:
    settings = get_settings()
    session_factory = get_session_factory(settings)
    registry = get_mock_identity_registry()

    async with session_factory() as session:
        users = list((await session.scalars(select(User))).all())
        assigned = 0

        for user in users:
            if user.service_user_id:
                continue

            profile = registry.registration_profile(email=user.email)
            user.service_user_id = profile.service_user_id
            assigned += 1

        if assigned:
            await session.commit()
            users = list((await session.scalars(select(User))).all())

        normalized_profiles: list[BackendUserProfile] = []
        for user in users:
            if not user.service_user_id:
                continue

            interests = [
                value for value in (user.interests or []) if isinstance(value, str)
            ]
            normalized_profiles.append(
                BackendUserProfile(
                    user_id=user.id,
                    ml_user_id=str(user.service_user_id),
                    email=(user.email or "").strip().lower(),
                    interests=interests,
                )
            )

    return normalized_profiles, assigned


async def _ensure_collection(
    *,
    client: httpx.AsyncClient,
    qdrant_url: str,
    collection: str,
    vector_size: int,
) -> None:
    get_resp = await client.get(f"{qdrant_url}/collections/{collection}")
    if get_resp.status_code == 200:
        return
    if get_resp.status_code != 404:
        get_resp.raise_for_status()

    create_resp = await client.put(
        f"{qdrant_url}/collections/{collection}",
        json={
            "vectors": {"size": vector_size, "distance": "Cosine"},
            "on_disk_payload": True,
        },
    )
    create_resp.raise_for_status()


async def _read_qdrant_snapshot(
    *,
    client: httpx.AsyncClient,
    qdrant_url: str,
    collection: str,
    backend_ids_normalized: set[str],
) -> QdrantSnapshot:
    normalized_party_ids: set[str] = set()
    orphan_point_ids: list[Any] = []
    top_categories: Counter[str] = Counter()
    points_count = 0
    offset: Any | None = None

    while True:
        payload: dict[str, Any] = {"limit": 1000, "with_payload": True}
        if offset is not None:
            payload["offset"] = offset

        response = await client.post(
            f"{qdrant_url}/collections/{collection}/points/scroll",
            json=payload,
        )
        response.raise_for_status()
        result = response.json().get("result", {})
        points = result.get("points", [])
        points_count += len(points)

        for point in points:
            point_id = point.get("id")
            payload_data = point.get("payload") or {}
            party_rk = payload_data.get("party_rk")

            top_cat = payload_data.get("top_cat")
            if isinstance(top_cat, str) and top_cat.strip():
                top_categories[top_cat.strip()] += 1

            if party_rk is None or str(party_rk).strip() == "":
                if point_id is not None:
                    orphan_point_ids.append(point_id)
                continue

            normalized_party_id = _normalize_ml_user_id(party_rk)
            normalized_party_ids.add(normalized_party_id)
            if (
                normalized_party_id not in backend_ids_normalized
                and point_id is not None
            ):
                orphan_point_ids.append(point_id)

        offset = result.get("next_page_offset")
        if offset is None:
            break

    suggested_categories = [category for category, _ in top_categories.most_common(5)]
    return QdrantSnapshot(
        points_count=points_count,
        normalized_party_ids=normalized_party_ids,
        orphan_point_ids=orphan_point_ids,
        suggested_categories=suggested_categories,
    )


async def _delete_orphans(
    *,
    client: httpx.AsyncClient,
    qdrant_url: str,
    collection: str,
    orphan_point_ids: list[Any],
    batch_size: int,
) -> int:
    deleted = 0
    for start in range(0, len(orphan_point_ids), batch_size):
        chunk = orphan_point_ids[start : start + batch_size]
        response = await client.post(
            f"{qdrant_url}/collections/{collection}/points/delete?wait=true",
            json={"points": chunk},
        )
        response.raise_for_status()
        deleted += len(chunk)
    return deleted


async def _direct_upsert_profiles(
    *,
    client: httpx.AsyncClient,
    qdrant_url: str,
    collection: str,
    users_to_sync: list[BackendUserProfile],
    vector_size: int,
    batch_size: int,
) -> int:
    upserted = 0
    for start in range(0, len(users_to_sync), batch_size):
        chunk = users_to_sync[start : start + batch_size]
        points = []
        for profile in chunk:
            categories = _build_favorite_categories(
                profile=profile,
                bootstrap_categories=list(DEFAULT_FAVORITE_CATEGORIES),
            )
            points.append(
                {
                    "id": _point_id_for_ml_user_id(profile.ml_user_id),
                    "vector": _fallback_vector(profile, size=vector_size),
                    "payload": {
                        "party_rk": profile.ml_user_id,
                        "favorite_categories": categories,
                        "preferred_activity_hour": _preferred_hour(profile.ml_user_id),
                        "import_transactions_enabled": False,
                        "top_cat": categories[0] if categories else "unknown",
                        "is_fallback_synced": True,
                    },
                }
            )

        response = await client.put(
            f"{qdrant_url}/collections/{collection}/points?wait=true",
            json={"points": points},
        )
        response.raise_for_status()
        upserted += len(chunk)
    return upserted


async def _upsert_profiles_via_ml(
    *,
    client: httpx.AsyncClient,
    ml_service_url: str,
    ml_service_token: str,
    users_to_sync: list[BackendUserProfile],
    bootstrap_categories: list[str],
) -> tuple[int, int]:
    synced_ok = 0
    synced_failed = 0

    headers = {"X-Service-Token": ml_service_token}
    endpoint = f"{ml_service_url.rstrip('/')}/v1/profile/preferences"

    for profile in users_to_sync:
        categories = _build_favorite_categories(
            profile=profile,
            bootstrap_categories=bootstrap_categories,
        )
        payload = {
            "trace_id": str(uuid4()),
            "user_id": profile.ml_user_id,
            "favorite_categories": categories,
            "import_transactions": False,
            "preferred_activity_hour": _preferred_hour(profile.ml_user_id),
        }
        response = await client.post(endpoint, headers=headers, json=payload)
        if response.status_code == 202:
            synced_ok += 1
            continue
        synced_failed += 1

    return synced_ok, synced_failed


async def _run(args: argparse.Namespace) -> int:
    settings = get_settings()
    ml_service_url = (args.ml_service_url or settings.ML_SERVICE_URL or "").strip()
    ml_service_token = (
        args.ml_service_token or settings.ML_SERVICE_TOKEN or ""
    ).strip()
    qdrant_url = (args.qdrant_url or DEFAULT_QDRANT_URL).rstrip("/")

    users, assigned = await _ensure_ml_user_ids()
    users_by_normalized_id = {
        _normalize_ml_user_id(profile.ml_user_id): profile for profile in users
    }
    backend_ids_normalized = set(users_by_normalized_id.keys())
    deleted_orphans = 0

    async with httpx.AsyncClient(timeout=30.0) as qdrant_client:
        await _ensure_collection(
            client=qdrant_client,
            qdrant_url=qdrant_url,
            collection=args.collection,
            vector_size=args.vector_size,
        )
        snapshot = await _read_qdrant_snapshot(
            client=qdrant_client,
            qdrant_url=qdrant_url,
            collection=args.collection,
            backend_ids_normalized=backend_ids_normalized,
        )
        if args.delete_orphans and snapshot.orphan_point_ids:
            deleted_orphans = await _delete_orphans(
                client=qdrant_client,
                qdrant_url=qdrant_url,
                collection=args.collection,
                orphan_point_ids=snapshot.orphan_point_ids,
                batch_size=args.batch_size,
            )

    qdrant_party_ids = snapshot.normalized_party_ids
    missing_normalized_ids = backend_ids_normalized - qdrant_party_ids
    if args.upsert_existing:
        users_to_sync = users
    else:
        users_to_sync = [
            users_by_normalized_id[user_id]
            for user_id in missing_normalized_ids
            if user_id in users_by_normalized_id
        ]

    configured_categories = _parse_categories(args.default_categories)
    bootstrap_categories = (
        configured_categories
        or snapshot.suggested_categories
        or list(DEFAULT_FAVORITE_CATEGORIES)
    )

    async with httpx.AsyncClient(timeout=20.0) as ml_client:
        synced_ok, synced_failed = await _upsert_profiles_via_ml(
            client=ml_client,
            ml_service_url=ml_service_url,
            ml_service_token=ml_service_token,
            users_to_sync=users_to_sync,
            bootstrap_categories=bootstrap_categories,
        )

    direct_upserted = 0
    async with httpx.AsyncClient(timeout=30.0) as qdrant_client:
        snapshot_after_ml = await _read_qdrant_snapshot(
            client=qdrant_client,
            qdrant_url=qdrant_url,
            collection=args.collection,
            backend_ids_normalized=backend_ids_normalized,
        )

        remaining_missing_ids = (
            backend_ids_normalized - snapshot_after_ml.normalized_party_ids
        )
        if remaining_missing_ids and args.direct_upsert_fallback:
            direct_upserted = await _direct_upsert_profiles(
                client=qdrant_client,
                qdrant_url=qdrant_url,
                collection=args.collection,
                users_to_sync=[
                    users_by_normalized_id[user_id]
                    for user_id in remaining_missing_ids
                    if user_id in users_by_normalized_id
                ],
                vector_size=args.vector_size,
                batch_size=args.batch_size,
            )
            snapshot_final = await _read_qdrant_snapshot(
                client=qdrant_client,
                qdrant_url=qdrant_url,
                collection=args.collection,
                backend_ids_normalized=backend_ids_normalized,
            )
        else:
            snapshot_final = snapshot_after_ml
        remaining_missing_ids = (
            backend_ids_normalized - snapshot_final.normalized_party_ids
        )

    print(
        "sync_summary "
        f"users_total={len(users)} "
        f"assigned_ml_ids={assigned} "
        f"qdrant_points_before={snapshot.points_count} "
        f"deleted_orphans={deleted_orphans} "
        f"sync_target={len(users_to_sync)} "
        f"ml_synced_ok={synced_ok} "
        f"ml_synced_failed={synced_failed} "
        f"direct_upserted={direct_upserted} "
        f"remaining_missing={len(remaining_missing_ids)}"
    )

    if synced_failed or remaining_missing_ids:
        if remaining_missing_ids:
            sample = sorted(list(remaining_missing_ids))[:10]
            print(f"sync_missing_sample={','.join(sample)}")
        return 1
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Synchronize backend users with ML Qdrant profiles.",
    )
    parser.add_argument("--ml-service-url", default="", help="ML service base URL")
    parser.add_argument("--ml-service-token", default="", help="ML service token")
    parser.add_argument(
        "--qdrant-url", default=DEFAULT_QDRANT_URL, help="Qdrant base URL"
    )
    parser.add_argument(
        "--collection", default=DEFAULT_COLLECTION, help="Qdrant collection name"
    )
    parser.add_argument(
        "--vector-size",
        type=int,
        default=35,
        help="Vector size for collection bootstrap",
    )
    parser.add_argument(
        "--batch-size", type=int, default=200, help="Batch size for orphan deletion"
    )
    parser.add_argument(
        "--delete-orphans",
        action="store_true",
        help="Delete Qdrant points whose payload.party_rk is not present in Postgres",
    )
    parser.add_argument(
        "--upsert-existing",
        action="store_true",
        help="Upsert all backend users via ML endpoint, not only missing ones",
    )
    parser.add_argument(
        "--default-categories",
        default="",
        help="Comma separated categories used for cold-start sync fallback",
    )
    parser.add_argument(
        "--no-direct-upsert-fallback",
        action="store_false",
        dest="direct_upsert_fallback",
        help="Disable direct Qdrant fallback upsert for users still missing after ML sync",
    )
    parser.set_defaults(direct_upsert_fallback=True)
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
