from __future__ import annotations

import asyncio

from core.crypto import hash_password
from database.relational_db import RolesInterface, User, UserInterface
from domain.auth.enums import DEFAULT_ROLE
from domain.dating.category_catalog import CategoryDefinition, pick_category_keys
from sqlalchemy.exc import IntegrityError
from service.mock_identity import MockIdentityRegistry
from service.avatar_assets import load_dataset_avatar_asset
from service.demo_accounts import DEMO_DATASET_INDEX_TO_KEY

from .base import SeedContext

_SCENARIO_INTERESTS_BY_EMAIL: dict[str, tuple[str, ...]] = {
    "demo.food.a@tmatch.local": ("рестораны", "фаст_фуд", "супермаркеты"),
    "demo.food.b@tmatch.local": ("супермаркеты", "фаст_фуд", "рестораны"),
    "demo.style@tmatch.local": ("одежда_обувь", "развлечения", "транспорт"),
    "demo.cold@tmatch.local": ("развлечения", "транспорт", "супермаркеты"),
}


class DatasetUsersSeedTask:
    name = "dataset_users"

    def __init__(
        self,
        *,
        registry: MockIdentityRegistry,
        category_definitions: tuple[CategoryDefinition, ...],
    ) -> None:
        self.registry = registry
        self.category_definitions = category_definitions

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

        avatar_asset = load_dataset_avatar_asset()

        for profile in profiles:
            user = await user_repo.get_by_service_user_id(profile.service_user_id)
            if user is None:
                user = await user_repo.get_by_email(profile.email)

            if user is None:
                try:
                    async with context.uow.session.begin_nested():
                        user = User(
                            email=profile.email,
                            password_hash=password_hash,
                        )
                        await user_repo.add(user)
                        await context.uow.session.flush()
                except IntegrityError:
                    user = await user_repo.get_by_service_user_id(
                        profile.service_user_id
                    )
                    if user is None:
                        user = await user_repo.get_by_email(profile.email)
                    if user is None:
                        raise

            user.service_user_id = profile.service_user_id
            user.email = profile.email
            user.password_hash = password_hash
            user.first_name = profile.first_name
            user.last_name = profile.last_name
            user.birth_date = profile.birth_date
            user.gender = profile.gender
            user.bio = profile.bio
            user.city_id = "msk"
            user.is_dataset_user = True
            user.demo_user_key = DEMO_DATASET_INDEX_TO_KEY.get(profile.dataset_index)
            user.quiz_started = False
            user.looking_for_genders = []
            user.age_range_min = None
            user.age_range_max = None
            user.distance_km = None
            user.goal = None
            scenario_interests = _SCENARIO_INTERESTS_BY_EMAIL.get(
                (profile.email or "").strip().lower()
            )
            if scenario_interests is not None:
                user.interests = list(scenario_interests)
            else:
                user.interests = pick_category_keys(
                    f"dataset-interests:{profile.service_user_id}",
                    min_items=3,
                    max_items=min(5, len(self.category_definitions) or 5),
                )
            user.avatar_status = "approved"
            user.avatar_rejection_reason = None

            user.avatar_key = f"avatars/{user.id}/{avatar_asset.filename}"

            await asyncio.to_thread(
                context.storage.put_object_bytes,
                bucket=context.settings.STORAGE_PUBLIC_BUCKET,
                key=user.avatar_key,
                payload=avatar_asset.payload,
                content_type=avatar_asset.content_type,
            )

            user.is_onboarded = user.can_open_feed
            await user_repo.assign_roles(user, [member_role])

        await context.uow.commit()
