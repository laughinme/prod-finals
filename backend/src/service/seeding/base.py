from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from core.config import Settings
from database.relational_db import UoW
from service.media import MediaStorageService
from service.mock_identity import MockIdentityRegistry, MockIdentityService


@dataclass(slots=True)
class SeedContext:
    uow: UoW
    settings: Settings
    storage: MediaStorageService
    identity_registry: MockIdentityRegistry
    identity_service: MockIdentityService


class SeedTask(Protocol):
    name: str

    async def run(self, context: SeedContext) -> None: ...


class SeedRegistry:
    def __init__(self, tasks: list[SeedTask]):
        self._tasks = tuple(tasks)

    async def run(self, context: SeedContext) -> None:
        for task in self._tasks:
            await task.run(context)

