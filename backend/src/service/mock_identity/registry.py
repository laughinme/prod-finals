from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
import random

from domain.dating.interests import INTEREST_OPTIONS


@dataclass(frozen=True, slots=True)
class MockIdentityProfile:
    service_user_id: str
    birth_date: date
    gender: str
    looking_for_genders: tuple[str, ...]
    age_range_min: int
    age_range_max: int
    interests: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class MockSeedAccount:
    index: int
    email: str
    username: str
    display_name: str
    bio: str
    demo_user_key: str
    roles: tuple[str, ...]
    profile: MockIdentityProfile


class MockIdentityRegistry:
    def __init__(self, profiles: list[MockIdentityProfile]):
        self._profiles = tuple(profiles)

    @classmethod
    def from_default_source(cls) -> "MockIdentityRegistry":
        ids_path = cls._resolve_ids_path()
        raw_ids = json.loads(ids_path.read_text(encoding="utf-8"))
        profiles = [cls._build_profile(service_user_id=value) for value in raw_ids]
        return cls(profiles)

    @staticmethod
    def _resolve_ids_path() -> Path:
        current_file = Path(__file__).resolve()
        candidates = [
            current_file.with_name("users.json"),
            current_file.parents[4] / "docs" / "users.json",
            current_file.parents[3] / "docs" / "users.json",
        ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        raise FileNotFoundError(
            "Could not locate users.json for mock identity registry. "
            f"Tried: {', '.join(str(path) for path in candidates)}"
        )

    @property
    def profiles(self) -> tuple[MockIdentityProfile, ...]:
        return self._profiles

    def build_seed_accounts(self, limit: int) -> list[MockSeedAccount]:
        accounts: list[MockSeedAccount] = []
        for index, profile in enumerate(self._profiles[:limit], start=1):
            interests = [self.label_for_interest(slug) for slug in profile.interests[:3]]
            bio = f"Люблю {', '.join(interests)} и новые знакомства."
            accounts.append(
                MockSeedAccount(
                    index=index,
                    email=f"mock-user-{index:04d}@example.com",
                    username=f"mock_user_{index:04d}",
                    display_name=f"Demo User {index:04d}",
                    bio=bio,
                    demo_user_key=f"mock_{index:04d}",
                    roles=("member", "admin") if index == 1 else ("member",),
                    profile=profile,
                )
            )
        return accounts

    def pick_available_profile(
        self,
        *,
        used_service_user_ids: set[str],
        seed: str,
    ) -> MockIdentityProfile:
        available = [
            profile
            for profile in self._profiles
            if profile.service_user_id not in used_service_user_ids
        ]
        if not available:
            return self._build_profile(service_user_id=self._build_runtime_service_user_id(seed))

        index = self._seeded_int(seed) % len(available)
        return available[index]

    def label_for_interest(self, slug: str) -> str:
        for value, label in INTEREST_OPTIONS:
            if value == slug:
                return label
        return slug

    @staticmethod
    def _build_runtime_service_user_id(seed: str) -> str:
        return f"runtime-{sha256(seed.encode('utf-8')).hexdigest()[:24]}"

    @classmethod
    def _build_profile(cls, *, service_user_id: str) -> MockIdentityProfile:
        rng = random.Random(cls._seeded_int(service_user_id))
        gender = rng.choices(
            population=["male", "female", "other"],
            weights=[46, 46, 8],
            k=1,
        )[0]

        age = 19 + rng.randrange(18)
        birth_date = date(
            date.today().year - age,
            1 + rng.randrange(12),
            1 + rng.randrange(28),
        )
        looking_for_genders = cls._build_looking_for_genders(gender, rng)
        age_range_min = max(18, age - (2 + rng.randrange(5)))
        age_range_max = min(99, age + (4 + rng.randrange(7)))
        interests = tuple(sorted(rng.sample([value for value, _ in INTEREST_OPTIONS], k=3 + rng.randrange(3))))
        return MockIdentityProfile(
            service_user_id=service_user_id,
            birth_date=birth_date,
            gender=gender,
            looking_for_genders=looking_for_genders,
            age_range_min=age_range_min,
            age_range_max=age_range_max,
            interests=interests,
        )

    @staticmethod
    def _build_looking_for_genders(gender: str, rng: random.Random) -> tuple[str, ...]:
        if gender == "male":
            base = ["female"]
        elif gender == "female":
            base = ["male"]
        else:
            base = ["male", "female"]

        if rng.random() > 0.8 and "other" not in base:
            base.append("other")
        return tuple(base)

    @staticmethod
    def _seeded_int(seed: str) -> int:
        return int(sha256(seed.encode("utf-8")).hexdigest()[:16], 16)
