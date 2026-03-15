from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from typing import Iterable


_FIRST_NAMES_BY_GENDER: dict[str, tuple[str, ...]] = {
    "male": (
        "Алексей",
        "Илья",
        "Иван",
        "Михаил",
        "Никита",
        "Роман",
        "Дмитрий",
        "Максим",
        "Кирилл",
        "Артем",
    ),
    "female": (
        "Анна",
        "Мария",
        "Екатерина",
        "Ольга",
        "Алина",
        "София",
        "Дарья",
        "Елена",
        "Виктория",
        "Полина",
    ),
}

_LAST_NAMES: tuple[str, ...] = (
    "Иванов",
    "Петров",
    "Смирнов",
    "Кузнецов",
    "Соколов",
    "Попов",
    "Лебедев",
    "Козлов",
    "Новиков",
    "Морозов",
)

_DEFAULT_INTERESTS: tuple[str, ...] = ("coffee", "music", "travel")


@dataclass(frozen=True, slots=True)
class MockIdentityProfile:
    service_user_id: str
    email: str
    username: str
    display_name: str
    gender: str
    birth_date: date
    bio: str
    is_dataset_user: bool


@dataclass(frozen=True, slots=True)
class DatasetUserProfile(MockIdentityProfile):
    dataset_index: int


class MockIdentityRegistry:
    def __init__(self, dataset_user_ids: Iterable[str]) -> None:
        normalized_ids = [str(item).strip() for item in dataset_user_ids if str(item).strip()]
        if not normalized_ids:
            raise ValueError("Mock identity dataset is empty")
        self._dataset_user_ids = tuple(dict.fromkeys(normalized_ids))

    @classmethod
    def from_default_source(cls) -> "MockIdentityRegistry":
        local_path = Path(__file__).with_name("users.json")
        repo_path = Path(__file__).resolve().parents[4] / "docs" / "users.json"
        source_path = repo_path if repo_path.exists() else local_path
        if not source_path.exists():
            raise FileNotFoundError(f"Mock identity ids file not found: {source_path}")

        raw_ids = json.loads(source_path.read_text(encoding="utf-8"))
        if not isinstance(raw_ids, list):
            raise ValueError("users.json must contain a JSON array")
        return cls(raw_ids)

    @property
    def dataset_size(self) -> int:
        return len(self._dataset_user_ids)

    def dataset_profiles(self) -> list[DatasetUserProfile]:
        return [
            self._build_dataset_profile(index=index, service_user_id=service_user_id)
            for index, service_user_id in enumerate(self._dataset_user_ids, start=1)
        ]

    def registration_profile(self, *, email: str) -> MockIdentityProfile:
        normalized_email = email.strip().lower()
        digest = sha256(normalized_email.encode("utf-8")).hexdigest()
        return self._build_profile(
            seed_key=f"registration:{normalized_email}",
            service_user_id=f"local-{digest[:32]}",
            email=normalized_email,
            username=f"user_{digest[:10]}",
            is_dataset_user=False,
        )

    def _build_dataset_profile(self, *, index: int, service_user_id: str) -> DatasetUserProfile:
        local_part = f"mock-user-{index:04d}"
        profile = self._build_profile(
            seed_key=f"dataset:{service_user_id}",
            service_user_id=service_user_id,
            email=f"{local_part}@example.com",
            username=local_part,
            is_dataset_user=True,
        )
        return DatasetUserProfile(
            service_user_id=profile.service_user_id,
            email=profile.email,
            username=profile.username,
            display_name=profile.display_name,
            gender=profile.gender,
            birth_date=profile.birth_date,
            bio=profile.bio,
            is_dataset_user=profile.is_dataset_user,
            dataset_index=index,
        )

    def _build_profile(
        self,
        *,
        seed_key: str,
        service_user_id: str,
        email: str,
        username: str,
        is_dataset_user: bool,
    ) -> MockIdentityProfile:
        digest = sha256(seed_key.encode("utf-8")).digest()
        gender = "female" if digest[0] % 2 else "male"
        first_names = _FIRST_NAMES_BY_GENDER[gender]
        first_name = first_names[digest[1] % len(first_names)]
        last_name = _LAST_NAMES[digest[2] % len(_LAST_NAMES)]
        age = 21 + (digest[3] % 18)
        month = 1 + (digest[4] % 12)
        day = 1 + (digest[5] % 28)
        birth_year = max(date.today().year - age, 1980)
        birth_date = date(birth_year, month, day)
        display_name = f"{first_name} {last_name}"
        bio = self._build_bio(first_name, digest)

        return MockIdentityProfile(
            service_user_id=service_user_id,
            email=email,
            username=username,
            display_name=display_name,
            gender=gender,
            birth_date=birth_date,
            bio=bio,
            is_dataset_user=is_dataset_user,
        )

    def _build_bio(self, first_name: str, digest: bytes) -> str:
        fragments = (
            "любит длинные прогулки",
            "не пропускает хороший кофе",
            "охотно выбирается в новые места",
            "любит музыку и живые концерты",
            "с удовольствием встречается офлайн",
        )
        picked = []
        for offset in range(3):
            picked.append(fragments[digest[6 + offset] % len(fragments)])
        unique = list(dict.fromkeys(picked))
        return f"{first_name} {', '.join(unique)}."


@lru_cache
def get_mock_identity_registry() -> MockIdentityRegistry:
    return MockIdentityRegistry.from_default_source()
