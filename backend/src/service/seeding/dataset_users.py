from __future__ import annotations

import asyncio

from core.crypto import hash_password
from database.relational_db import RolesInterface, User, UserInterface
from domain.auth.enums import DEFAULT_ROLE
from service.mock_identity import MockIdentityRegistry

from .base import SeedContext


SEED_AVATAR_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc``\x00\x00\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


class DatasetUsersSeedTask:
    name = "dataset_users"

    def __init__(self, *, registry: MockIdentityRegistry) -> None:
        self.registry = registry

    async def should_run(self, context: SeedContext) -> bool:
        return context.settings.MOCK_USER_SEED_ENABLED

    async def run(self, context: SeedContext) -> None:
        user_repo = UserInterface(context.uow.session)
        role_repo = RolesInterface(context.uow.session)
        member_role = await role_repo.get_by_slug(DEFAULT_ROLE.value)
        if member_role is None:
            raise RuntimeError("Default member role is missing from the database")

        password_hash = await hash_password(context.settings.MOCK_USER_SEED_PASSWORD)

        limit = max(context.settings.MOCK_USER_SEED_LIMIT, 0)
        profiles = self.registry.dataset_profiles()
        if limit:
            profiles = profiles[:limit]

        for profile in profiles:
            user = await user_repo.get_by_service_user_id(profile.service_user_id)
            if user is None:
                user = await user_repo.get_by_email(profile.email)

            if user is None:
                user = User(
                    email=profile.email,
                    password_hash=password_hash,
                )
                await user_repo.add(user)
                await context.uow.session.flush()

            user.service_user_id = profile.service_user_id
            user.email = profile.email
            user.password_hash = password_hash
            user.username = profile.username
            user.display_name = profile.display_name
            user.birth_date = profile.birth_date
            user.gender = profile.gender
            user.bio = profile.bio
            user.is_dataset_user = True
            user.quiz_started = False
            user.looking_for_genders = []
            user.age_range_min = None
            user.age_range_max = None
            user.distance_km = None
            user.goal = None
            user.interests = []
            user.avatar_status = "approved"
            user.avatar_rejection_reason = None

            if not user.avatar_key:
                user.avatar_key = f"avatars/{user.id}/seed.png"

            await asyncio.to_thread(
                context.storage.put_object_bytes,
                bucket=context.settings.STORAGE_PUBLIC_BUCKET,
                key=user.avatar_key,
                payload=SEED_AVATAR_BYTES,
                content_type="image/png",
            )

            user.is_onboarded = user.can_open_feed
            await user_repo.assign_roles(user, [member_role])

        await context.uow.commit()
