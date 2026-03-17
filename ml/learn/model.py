from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import math
import subprocess
from typing import Any

from .prepare_data import Transaction


@dataclass(slots=True)
class UserProfile:
    top_category: str
    avg_hour: float
    vector: list[float]


@dataclass(slots=True)
class MatchModelArtifact:
    model_type: str
    model_version: str
    trained_at: str
    transaction_count: int
    user_count: int
    categories: list[str]
    profiles: dict[str, UserProfile]
    git_commit_hash: str = ""
    git_branch: str = ""


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(a * a for a in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return dot / (left_norm * right_norm)


def _safe_model_version(now: datetime) -> str:
    return now.strftime("%Y%m%dT%H%M%SZ")


def _safe_git_value(command: list[str], default: str = "") -> str:
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return default
    return result.stdout.strip() or default


def train_profile_model(transactions: list[Transaction]) -> MatchModelArtifact:
    if not transactions:
        raise ValueError("At least one transaction is required for training.")

    category_set: set[str] = set()
    user_category_counts: dict[str, Counter[str]] = defaultdict(Counter)
    user_hour_sum: dict[str, float] = defaultdict(float)
    user_tx_count: dict[str, int] = defaultdict(int)

    for tx in transactions:
        category_set.add(tx.category)
        user_category_counts[tx.user_id][tx.category] += 1
        user_hour_sum[tx.user_id] += float(tx.timestamp.hour)
        user_tx_count[tx.user_id] += 1

    categories = sorted(category_set)
    category_index = {name: idx for idx, name in enumerate(categories)}

    profiles: dict[str, UserProfile] = {}
    for user_id, category_counts in user_category_counts.items():
        tx_count = user_tx_count[user_id]
        vector = [0.0] * (len(categories) + 1)

        for category, count in category_counts.items():
            vector[category_index[category]] = count / tx_count

        avg_hour = user_hour_sum[user_id] / tx_count
        vector[-1] = avg_hour / 23.0 if avg_hour > 0 else 0.0

        top_category = category_counts.most_common(1)[0][0]
        profiles[user_id] = UserProfile(
            top_category=top_category,
            avg_hour=avg_hour,
            vector=vector,
        )

    now = datetime.now(tz=timezone.utc)
    return MatchModelArtifact(
        model_type="user-interest-v1",
        model_version=_safe_model_version(now),
        trained_at=now.isoformat(),
        transaction_count=len(transactions),
        user_count=len(profiles),
        categories=categories,
        profiles=profiles,
        git_commit_hash=_safe_git_value(["git", "rev-parse", "HEAD"]),
        git_branch=_safe_git_value(["git", "rev-parse", "--abbrev-ref", "HEAD"]),
    )


def get_matches(
    artifact: MatchModelArtifact, user_id: str, top_n: int = 5
) -> list[dict[str, float | str]]:
    target = artifact.profiles.get(user_id)
    if target is None:
        return []

    results: list[dict[str, float | str]] = []
    for candidate_id, candidate in artifact.profiles.items():
        if candidate_id == user_id:
            continue
        score = _cosine_similarity(target.vector, candidate.vector)
        results.append({"user_id": candidate_id, "score": score})

    results.sort(key=lambda row: float(row["score"]), reverse=True)
    return results[:top_n]


def artifact_to_json_bytes(artifact: MatchModelArtifact) -> bytes:
    payload = asdict(artifact)
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )


def artifact_from_json_bytes(payload: bytes) -> MatchModelArtifact:
    raw = json.loads(payload.decode("utf-8"))

    profiles_raw: dict[str, Any] = raw.get("profiles", {})
    profiles: dict[str, UserProfile] = {}
    for user_id, data in profiles_raw.items():
        profiles[user_id] = UserProfile(
            top_category=str(data["top_category"]),
            avg_hour=float(data["avg_hour"]),
            vector=[float(item) for item in data["vector"]],
        )

    return MatchModelArtifact(
        model_type=str(raw["model_type"]),
        model_version=str(raw["model_version"]),
        trained_at=str(raw["trained_at"]),
        transaction_count=int(raw["transaction_count"]),
        user_count=int(raw["user_count"]),
        categories=[str(item) for item in raw.get("categories", [])],
        profiles=profiles,
        git_commit_hash=str(raw.get("git_commit_hash", "")),
        git_branch=str(raw.get("git_branch", "")),
    )
