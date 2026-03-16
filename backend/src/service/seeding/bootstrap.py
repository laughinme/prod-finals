from __future__ import annotations

from domain.dating.category_catalog import load_category_definitions
from service.mock_identity import get_mock_identity_registry

from .admin_user import AdminUserSeedTask
from .avatar_backfill import AvatarBackfillSeedTask
from .base import SeedContext, SeedTask
from .categories import PreferenceCategoriesSeedTask
from .dataset_users import DatasetUsersSeedTask


class SeederRegistry:
    def __init__(self, tasks: list[SeedTask]) -> None:
        self._tasks = tasks

    async def run(self, context: SeedContext) -> None:
        for task in self._tasks:
            if await task.should_run(context):
                await task.run(context)


def build_seeder_registry() -> SeederRegistry:
    category_definitions = load_category_definitions()
    registry = get_mock_identity_registry()
    return SeederRegistry(
        tasks=[
            PreferenceCategoriesSeedTask(categories=category_definitions),
            AdminUserSeedTask(registry=registry),
            DatasetUsersSeedTask(
                registry=registry,
                category_definitions=category_definitions,
            ),
            AvatarBackfillSeedTask(),
        ]
    )


async def run_registered_seeders(context: SeedContext) -> None:
    registry = build_seeder_registry()
    await registry.run(context)
