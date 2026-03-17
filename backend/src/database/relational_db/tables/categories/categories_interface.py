from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.dating.category_catalog import CategoryDefinition

from .categories_table import PreferenceCategory


class PreferenceCategoryInterface:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_active(self) -> list[PreferenceCategory]:
        rows = await self.session.scalars(
            select(PreferenceCategory)
            .where(PreferenceCategory.is_active.is_(True))
            .order_by(
                PreferenceCategory.sort_order.asc(), PreferenceCategory.label.asc()
            )
        )
        return list(rows.all())

    async def upsert_definitions(self, definitions: list[CategoryDefinition]) -> None:
        existing = {
            row.key: row
            for row in await self.session.scalars(select(PreferenceCategory))
        }

        for definition in definitions:
            category = existing.get(definition.key)
            if category is None:
                category = PreferenceCategory(
                    key=definition.key,
                    label=definition.label,
                    source_count=definition.source_count,
                    sort_order=definition.sort_order,
                    is_active=True,
                )
                self.session.add(category)
                continue

            category.label = definition.label
            category.source_count = definition.source_count
            category.sort_order = definition.sort_order
            category.is_active = True
