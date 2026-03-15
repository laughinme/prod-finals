from core.config import Settings
from database.relational_db import UoW, UserInterface
from service.media import MediaStorageService
from service.mock_identity import MockIdentityService, get_mock_identity_registry
from service.seeding import DemoSeedSettings, MockUsersSeedTask, SeedContext, SeedRegistry


async def ensure_dev_seed(
    *,
    uow: UoW,
    storage: MediaStorageService,
    settings: Settings,
) -> None:
    if settings.APP_STAGE == "prod" or not settings.DEV_SEED_ENABLED:
        return

    identity_registry = get_mock_identity_registry()
    identity_service = MockIdentityService(UserInterface(uow.session), identity_registry)
    seed_registry = SeedRegistry(
        [
            MockUsersSeedTask(
                DemoSeedSettings(
                    password=settings.MOCK_USER_SEED_PASSWORD,
                    limit=settings.MOCK_USER_SEED_LIMIT,
                )
            )
        ]
    )

    await seed_registry.run(
        SeedContext(
            uow=uow,
            settings=settings,
            storage=storage,
            identity_registry=identity_registry,
            identity_service=identity_service,
        )
    )
