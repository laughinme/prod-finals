import asyncio

from core.config import get_settings
from database.relational_db import UoW, get_session_factory
from service.dev_seed import ensure_dev_seed
from service.media import get_media_storage_service


async def main() -> None:
    settings = get_settings()
    session_factory = get_session_factory(settings)
    storage = get_media_storage_service()
    async with session_factory() as session:
        async with UoW(session) as uow:
            await ensure_dev_seed(uow=uow, storage=storage, settings=settings)


if __name__ == "__main__":
    asyncio.run(main())
