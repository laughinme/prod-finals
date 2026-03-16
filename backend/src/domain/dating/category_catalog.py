from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from hashlib import sha256
from pathlib import Path


@dataclass(frozen=True, slots=True)
class CategoryDefinition:
    key: str
    label: str
    source_count: int
    sort_order: int


_CURATED_LABELS: tuple[str, ...] = (
    "Рестораны",
    "Развлечения",
    "Фаст Фуд",
    "Одежда/Обувь",
    "Транспорт",
    "Супермаркеты",
)
_CURATED_LABEL_RANK = {label: index for index, label in enumerate(_CURATED_LABELS)}


def _catalog_source_path() -> Path:
    local_path = Path(__file__).with_name("categories.json")
    repo_path = Path(__file__).resolve().parents[4] / "docs" / "categories.json"
    if repo_path.exists():
        return repo_path
    return local_path


def _normalize_category_key(label: str) -> str:
    normalized = re.sub(r"\W+", "_", label.strip().lower(), flags=re.UNICODE).strip("_")
    if normalized:
        return normalized
    return f"category_{sha256(label.encode('utf-8')).hexdigest()[:12]}"


@lru_cache
def load_category_definitions() -> tuple[CategoryDefinition, ...]:
    source_path = _catalog_source_path()
    payload = json.loads(source_path.read_text(encoding="utf-8"))
    hits = payload.get("result", {}).get("hits", [])
    definitions: list[CategoryDefinition] = []
    seen_keys: set[str] = set()

    for index, hit in enumerate(hits, start=1):
        label = str(hit.get("value", "")).strip()
        if not label or label not in _CURATED_LABEL_RANK:
            continue
        key = _normalize_category_key(label)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        definitions.append(
            CategoryDefinition(
                key=key,
                label=label,
                source_count=int(hit.get("count", 0) or 0),
                sort_order=_CURATED_LABEL_RANK[label],
            )
        )

    definitions.sort(key=lambda item: item.sort_order)
    return tuple(definitions)


def category_label_map() -> dict[str, str]:
    return {item.key: item.label for item in load_category_definitions()}


def pick_category_keys(seed_key: str, *, min_items: int = 3, max_items: int = 5) -> list[str]:
    definitions = load_category_definitions()
    if not definitions:
        return []

    digest = sha256(seed_key.encode("utf-8")).digest()
    target_count = min_items + (digest[0] % max(max_items - min_items + 1, 1))

    scored = sorted(
        definitions,
        key=lambda item: sha256(f"{seed_key}:{item.key}".encode("utf-8")).digest(),
        reverse=True,
    )
    return [item.key for item in scored[:target_count]]
