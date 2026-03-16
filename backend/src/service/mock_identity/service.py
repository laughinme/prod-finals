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
        user.first_name = user.first_name or profile.first_name
        user.last_name = user.last_name or profile.last_name
        user.bio = user.bio or profile.bio
        user.city_id = user.city_id or "msk"
        user.is_dataset_user = False
