from __future__ import annotations

from collections.abc import Mapping, Sequence
import csv
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import random
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class Transaction:
    user_id: str
    category: str
    timestamp: datetime


def _parse_timestamp(raw: Any) -> datetime:
    if isinstance(raw, datetime):
        return (
            raw.astimezone(timezone.utc)
            if raw.tzinfo
            else raw.replace(tzinfo=timezone.utc)
        )

    value = str(raw).strip()
    if not value:
        raise ValueError("Timestamp is empty.")

    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_category(raw: Any) -> str:
    value = str(raw).strip()
    return value if value else "unknown"


def transaction_from_mapping(row: Mapping[str, Any]) -> Transaction:
    user_id = str(row.get("party_rk", "")).strip()
    if not user_id:
        raise ValueError("party_rk is required.")

    if user_id.isdigit():
        user_id = f"user-{user_id}"

    return Transaction(
        user_id=user_id,
        category=_normalize_category(row.get("category_nm", "unknown")),
        timestamp=_parse_timestamp(row.get("real_transaction_dttm")),
    )


def coerce_transactions(rows: Sequence[Mapping[str, Any]]) -> list[Transaction]:
    transactions: list[Transaction] = []
    for row in rows:
        transactions.append(transaction_from_mapping(row))
    return transactions


def load_transactions_csv(path: str | Path) -> list[Transaction]:
    csv_path = Path(path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    rows: list[dict[str, Any]] = []
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(row)
    return coerce_transactions(rows)


def generate_sample_transactions(
    *,
    user_count: int = 10,
    transactions_per_user: int = 12,
    seed: int = 42,
) -> list[Transaction]:
    if user_count < 2:
        raise ValueError("user_count must be >= 2")
    if transactions_per_user < 1:
        raise ValueError("transactions_per_user must be >= 1")

    rng = random.Random(seed)
    categories = ["grocery", "cafe", "transport", "electronics", "health", "travel"]
    base_time = datetime.now(tz=timezone.utc) - timedelta(days=30)

    transactions: list[Transaction] = []
    for user_index in range(user_count):
        user_id = f"user-{user_index + 1}"
        preferred = categories[user_index % len(categories)]

        for _ in range(transactions_per_user):
            category = preferred if rng.random() < 0.65 else rng.choice(categories)
            timestamp = base_time + timedelta(
                days=rng.randint(0, 29),
                hours=rng.randint(0, 23),
                minutes=rng.randint(0, 59),
            )
            transactions.append(
                Transaction(
                    user_id=user_id,
                    category=category,
                    timestamp=timestamp,
                )
            )

    return transactions
