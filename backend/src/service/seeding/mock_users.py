from __future__ import annotations

import asyncio
from dataclasses import dataclass

from core.crypto import hash_password
from database.relational_db import RolesInterface, User, UserInterface
from domain.auth.enums import DEFAULT_ROLE

from .base import SeedContext


SEED_AVATAR_KEY = "avatars/system/mock-seed.png"
SEED_AVATAR_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc``\x00\x00\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


@dataclass(frozen=True, slots=True)
class DemoSeedSettings:
    password: str
    limit: int


class MockUsersSeedTask:
    name = "mock_users"

    def __init__(self, settings: DemoSeedSettings):
        self.settings = settings

    async def run(self, context: SeedContext) -> None:
        user_repo = UserInterface(context.uow.session)
        role_repo = RolesInterface(context.uow.session)

        member_role = await role_repo.get_by_slug(DEFAULT_ROLE.value)
        admin_role = await role_repo.get_by_slug("admin")
        if member_role is None:
            raise RuntimeError("Default role is missing from the database")

        password_hash = await hash_password(self.settings.password)
        await asyncio.to_thread(
            context.storage.put_object_bytes,
            bucket=context.settings.STORAGE_PUBLIC_BUCKET,
            key=SEED_AVATAR_KEY,
            payload=SEED_AVATAR_BYTES,
            content_type="image/png",
        )

        for account in context.identity_registry.build_seed_accounts(self.settings.limit):
            user = await user_repo.get_by_email(account.email)
            if user is None:
                user = User(
                    email=account.email,
                    password_hash=password_hash,
                    username=account.username,
                )
                await user_repo.add(user)
                await context.uow.session.flush()

            user.password_hash = password_hash
            user.username = account.username
            user.display_name = account.display_name
            user.bio = account.bio
            user.avatar_key = SEED_AVATAR_KEY
            user.avatar_status = "approved"
            user.avatar_rejection_reason = None
            user.city_id = None
            user.distance_km = None
            user.goal = None
            user.quiz_started = True
            user.demo_user_key = account.demo_user_key
            user.is_onboarded = True

            context.identity_service.apply_known_profile(user, account.profile, overwrite=True)

            roles = [member_role]
            if admin_role is not None and "admin" in account.roles:
                roles = [member_role, admin_role]
            await user_repo.assign_roles(user, roles)

        await context.uow.commit()
