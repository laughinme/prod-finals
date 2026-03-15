from __future__ import annotations

from database.relational_db import User

from .registry import MockIdentityRegistry


class MockIdentityService:
    def __init__(self, registry: MockIdentityRegistry) -> None:
        self.registry = registry

    def apply_registration_defaults(self, user: User) -> None:
        profile = self.registry.registration_profile(email=user.email)
        user.service_user_id = user.service_user_id or profile.service_user_id
        user.gender = user.gender or profile.gender
        user.birth_date = user.birth_date or profile.birth_date
        user.display_name = user.display_name or profile.display_name
        user.username = user.username or profile.username
        user.bio = user.bio or profile.bio
        user.is_dataset_user = False
