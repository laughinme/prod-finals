from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import math
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import httpx
from sqlalchemy import select

from core.config import get_settings
from database.relational_db import User, get_session_factory


DEFAULT_QDRANT_URL = "http://qdrant:6333"
DEFAULT_COLLECTION = "user_profiles"
DEFAULT_LIMIT = 300
DEFAULT_SCAN_TOP_PAIRS = 2000


@dataclass(slots=True)
class QdrantPoint:
    ml_user_id: str
    vector: list[float]


@dataclass(slots=True)
class DbUser:
    email: str
    full_name: str


def _normalize_ml_user_id(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _extract_vector(raw: object) -> list[float]:
    if isinstance(raw, list):
        return [float(item) for item in raw]
    if isinstance(raw, dict):
        default_vector = raw.get("default")
        if isinstance(default_vector, list):
            return [float(item) for item in default_vector]
        for value in raw.values():
            if isinstance(value, list):
                return [float(item) for item in value]
    return []


def _normalize_vector(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(item * item for item in vector))
    if norm <= 1e-12:
        return []
    return [item / norm for item in vector]


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(lhs * rhs for lhs, rhs in zip(a, b))


async def _load_qdrant_points(
    *,
    client: httpx.AsyncClient,
    qdrant_url: str,
    collection: str,
) -> list[QdrantPoint]:
    offset: Any | None = None
    points: list[QdrantPoint] = []
    seen: set[str] = set()

    while True:
        payload: dict[str, Any] = {
            "limit": 1000,
            "with_payload": True,
            "with_vectors": True,
        }
        if offset is not None:
            payload["offset"] = offset

        response = await client.post(
            f"{qdrant_url}/collections/{collection}/points/scroll",
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        result = body.get("result") or {}

        for point in result.get("points", []):
            point_payload = point.get("payload") or {}
            ml_user_id = _normalize_ml_user_id(point_payload.get("party_rk"))
            if not ml_user_id or ml_user_id in seen:
                continue

            vector = _normalize_vector(_extract_vector(point.get("vector")))
            if not vector:
                continue

            seen.add(ml_user_id)
            points.append(QdrantPoint(ml_user_id=ml_user_id, vector=vector))

        offset = result.get("next_page_offset")
        if offset is None:
            break

    return points


def _build_sorted_pairs(points: list[QdrantPoint]) -> list[tuple[float, str, str]]:
    pairs: list[tuple[float, str, str]] = []
    for index, left in enumerate(points):
        for right in points[index + 1 :]:
            similarity = _cosine(left.vector, right.vector)
            pairs.append((similarity, left.ml_user_id, right.ml_user_id))
    pairs.sort(reverse=True, key=lambda item: item[0])
    return pairs


async def _load_db_users() -> dict[str, DbUser]:
    settings = get_settings()
    session_factory = get_session_factory(settings)

    async with session_factory() as session:
        rows = (
            await session.execute(
                select(
                    User.service_user_id,
                    User.email,
                    User.first_name,
                    User.last_name,
                ).where(User.service_user_id.is_not(None))
            )
        ).all()

    users: dict[str, DbUser] = {}
    for service_user_id, email, first_name, last_name in rows:
        ml_user_id = _normalize_ml_user_id(service_user_id)
        if not ml_user_id:
            continue
        full_name = " ".join(part.strip() for part in (first_name, last_name) if part and part.strip()).strip()
        users[ml_user_id] = DbUser(email=email, full_name=full_name)
    return users


async def _fetch_ml_ranks(
    *,
    client: httpx.AsyncClient,
    ml_service_url: str,
    ml_service_token: str,
    request_user_id: str,
    limit: int,
    strategy: str,
) -> dict[str, int]:
    payload = {
        "trace_id": str(uuid4()),
        "request_user_id": request_user_id,
        "limit": limit,
        "strategy": strategy,
        "context": {
            "request_ts": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "client": "web",
            "decision_policy": "daily_batch",
        },
    }
    response = await client.post(
        f"{ml_service_url.rstrip('/')}/v1/recommendations",
        headers={"X-Service-Token": ml_service_token},
        json=payload,
    )
    if response.status_code >= 400:
        preview = response.text[:500].replace("\n", " ")
        raise RuntimeError(f"ML recommendations failed with status={response.status_code}: {preview}")

    body = response.json()
    candidates = body.get("candidates") or []
    ranks: dict[str, int] = {}
    for rank, candidate in enumerate(candidates, start=1):
        candidate_id = _normalize_ml_user_id(candidate.get("candidate_user_id"))
        if candidate_id and candidate_id not in ranks:
            ranks[candidate_id] = rank
    return ranks


async def _run(args: argparse.Namespace) -> int:
    settings = get_settings()
    ml_service_url = (args.ml_service_url or settings.ML_SERVICE_URL or "http://ml-service:8080").strip()
    ml_service_token = (args.ml_service_token or settings.ML_SERVICE_TOKEN or "").strip()

    if not ml_service_token:
        print("ML_SERVICE_TOKEN is empty. Set token in env or pass --ml-service-token.")
        return 1

    async with httpx.AsyncClient(timeout=30.0) as qdrant_client:
        points = await _load_qdrant_points(
            client=qdrant_client,
            qdrant_url=args.qdrant_url.rstrip("/"),
            collection=args.collection,
        )

    if len(points) < 2:
        print(f"Not enough vectors in Qdrant: {len(points)}")
        return 1

    db_users = await _load_db_users()
    pairs = _build_sorted_pairs(points)
    top_pairs = pairs[: max(args.scan_top_pairs, 1)]

    rank_cache: dict[str, dict[str, int]] = {}
    failed_requests = 0

    async with httpx.AsyncClient(timeout=30.0) as ml_client:
        for similarity, left_id, right_id in top_pairs:
            if left_id not in db_users or right_id not in db_users:
                continue

            if left_id not in rank_cache:
                try:
                    rank_cache[left_id] = await _fetch_ml_ranks(
                        client=ml_client,
                        ml_service_url=ml_service_url,
                        ml_service_token=ml_service_token,
                        request_user_id=left_id,
                        limit=args.limit,
                        strategy=args.strategy,
                    )
                except Exception as exc:
                    failed_requests += 1
                    print(f"skip_user={left_id} reason={exc}")
                    continue
            if right_id not in rank_cache:
                try:
                    rank_cache[right_id] = await _fetch_ml_ranks(
                        client=ml_client,
                        ml_service_url=ml_service_url,
                        ml_service_token=ml_service_token,
                        request_user_id=right_id,
                        limit=args.limit,
                        strategy=args.strategy,
                    )
                except Exception as exc:
                    failed_requests += 1
                    print(f"skip_user={right_id} reason={exc}")
                    continue

            left_rank = rank_cache[left_id].get(right_id)
            right_rank = rank_cache[right_id].get(left_id)

            if left_rank is not None and right_rank is not None:
                left_user = db_users[left_id]
                right_user = db_users[right_id]
                print("reciprocal_pair_found=true")
                print(f"similarity={similarity:.6f}")
                print(f"user_a_ml_id={left_id}")
                print(f"user_a_email={left_user.email}")
                print(f"user_a_name={left_user.full_name or '-'}")
                print(f"user_a_rank_to_b={left_rank}")
                print(f"user_b_ml_id={right_id}")
                print(f"user_b_email={right_user.email}")
                print(f"user_b_name={right_user.full_name or '-'}")
                print(f"user_b_rank_to_a={right_rank}")
                print(f"checked_limit={args.limit}")
                return 0

    print("reciprocal_pair_found=false")
    print(f"checked_pairs={len(top_pairs)}")
    print(f"checked_limit={args.limit}")
    print(f"failed_ml_requests={failed_requests}")
    print("Try a larger --limit or --scan-top-pairs.")
    return 1


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Find two closest Qdrant users that mutually appear in ML recommendations.",
    )
    parser.add_argument("--qdrant-url", default=DEFAULT_QDRANT_URL, help="Qdrant base URL")
    parser.add_argument("--collection", default=DEFAULT_COLLECTION, help="Qdrant collection name")
    parser.add_argument("--ml-service-url", default="", help="ML service URL (defaults to settings)")
    parser.add_argument("--ml-service-token", default="", help="ML service token (defaults to settings)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Recommendation limit per user")
    parser.add_argument(
        "--scan-top-pairs",
        type=int,
        default=DEFAULT_SCAN_TOP_PAIRS,
        help="How many closest Qdrant pairs to scan",
    )
    parser.add_argument("--strategy", default="balanced", help="ML recommendation strategy")
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
