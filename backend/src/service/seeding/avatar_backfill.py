from __future__ import annotations

import asyncio

from database.relational_db import UserInterface
from service.avatar_assets import load_dataset_avatar_asset, load_default_avatar_asset
from service.demo_accounts import DEMO_DATASET_EMAIL_TO_KEY

from .base import SeedContext


class AvatarBackfillSeedTask:
    name = "avatar_backfill"

    async def should_run(self, context: SeedContext) -> bool:
        return context.settings.MOCK_USER_SEED_ENABLED

    async def run(self, context: SeedContext) -> None:
        user_repo = UserInterface(context.uow.session)
        users = await user_repo.list_users_missing_avatar()
        if not users:
            return

        default_asset = load_default_avatar_asset()
        dataset_asset = load_dataset_avatar_asset()

        for user in users:
            asset = dataset_asset if user.is_dataset_user else default_asset
            user.avatar_key = f"avatars/{user.id}/{asset.filename}"
            user.avatar_status = "approved"
            user.avatar_rejection_reason = None
            if user.is_dataset_user:
                demo_user_key = DEMO_DATASET_EMAIL_TO_KEY.get(
                    (user.email or "").strip().lower()
                )
                if demo_user_key:
                    user.demo_user_key = demo_user_key

            await asyncio.to_thread(
                context.storage.put_object_bytes,
                bucket=context.settings.STORAGE_PUBLIC_BUCKET,
                key=user.avatar_key,
                payload=asset.payload,
                content_type=asset.content_type,
            )

        await context.uow.commit()
