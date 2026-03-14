from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .cities_table import City


class CitiesInterface:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, city_id: str | None) -> City | None:
        if city_id is None:
            return None
        return await self.session.scalar(select(City).where(City.id == city_id))

    async def list_all(self) -> list[City]:
        rows = await self.session.scalars(select(City).order_by(City.name.asc()))
        return list(rows.all())
