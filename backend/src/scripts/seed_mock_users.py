from __future__ import annotations

import asyncio

from core.config import get_settings
from database.relational_db import UoW, get_session_factory
from service.media import get_media_storage_service
from service.seeding import run_registered_seeders
from service.seeding.base import SeedContext


async def _main() -> None:
    settings = get_settings()
    storage = get_media_storage_service()
    session_factory = get_session_factory(settings)

    await asyncio.to_thread(storage.ensure_buckets)

    async with session_factory() as session:
        async with UoW(session) as uow:
            await run_registered_seeders(
                SeedContext(
                    settings=settings,
                    uow=uow,
                    storage=storage,
                )
            )


if __name__ == "__main__":
    asyncio.run(_main())
