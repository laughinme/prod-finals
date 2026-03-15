from __future__ import annotations

from database.relational_db import User, UserInterface

from .registry import MockIdentityProfile, MockIdentityRegistry


class MockIdentityService:
    def __init__(self, user_repo: UserInterface, registry: MockIdentityRegistry):
        self.user_repo = user_repo
        self.registry = registry

    async def assign_profile(self, user: User, *, seed: str, overwrite: bool = False) -> MockIdentityProfile:
        if user.service_user_id and not overwrite:
            profile = next(
                (item for item in self.registry.profiles if item.service_user_id == user.service_user_id),
                None,
            )
            if profile is None:
                profile = self.registry._build_profile(service_user_id=user.service_user_id)
            self.apply_identity_fields(user, profile, overwrite=False)
            return profile

        used_service_user_ids = set(await self.user_repo.list_service_user_ids())
        if user.service_user_id:
            used_service_user_ids.discard(user.service_user_id)

        profile = self.registry.pick_available_profile(
            used_service_user_ids=used_service_user_ids,
            seed=seed,
        )
        self.apply_identity_fields(user, profile, overwrite=overwrite)
        return profile

    def apply_known_profile(self, user: User, profile: MockIdentityProfile, *, overwrite: bool) -> None:
        self.apply_identity_fields(user, profile, overwrite=overwrite)
        if overwrite or not user.looking_for_genders:
            user.looking_for_genders = list(profile.looking_for_genders)
        if overwrite or user.age_range_min is None:
            user.age_range_min = profile.age_range_min
        if overwrite or user.age_range_max is None:
            user.age_range_max = profile.age_range_max
        if overwrite or not user.interests:
            user.interests = list(profile.interests)

    def apply_identity_fields(self, user: User, profile: MockIdentityProfile, *, overwrite: bool) -> None:
        if overwrite or not user.service_user_id:
            user.service_user_id = profile.service_user_id
        if overwrite or user.birth_date is None:
            user.birth_date = profile.birth_date
        if overwrite or user.gender is None:
            user.gender = profile.gender
