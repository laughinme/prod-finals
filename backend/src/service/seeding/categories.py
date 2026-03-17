from __future__ import annotations

from database.relational_db import PreferenceCategoryInterface
from domain.dating.category_catalog import CategoryDefinition

from .base import SeedContext


class PreferenceCategoriesSeedTask:
    name = "preference_categories"

    def __init__(self, *, categories: tuple[CategoryDefinition, ...]) -> None:
        self.categories = categories

    async def should_run(self, context: SeedContext) -> bool:
        return context.settings.MOCK_USER_SEED_ENABLED

    async def run(self, context: SeedContext) -> None:
        repo = PreferenceCategoryInterface(context.uow.session)
        await repo.upsert_definitions(list(self.categories))
        await context.uow.session.flush()
