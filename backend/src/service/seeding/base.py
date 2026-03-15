from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from core.config import Settings
from database.relational_db import UoW
from service.media import MediaStorageService


@dataclass(slots=True)
class SeedContext:
    settings: Settings
    uow: UoW
    storage: MediaStorageService


class SeedTask(Protocol):
    name: str

    async def should_run(self, context: SeedContext) -> bool: ...

    async def run(self, context: SeedContext) -> None: ...
