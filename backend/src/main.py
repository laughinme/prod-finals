import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime
import logging

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from api import get_api_routers
from webhooks import get_webhooks
from core.config import Settings, configure_logging, get_settings
from core.error_handling import register_exception_handlers
from core.middlewares import RequestTracingMiddleware
from core.rate_limit import init_rate_limiters
from database.redis import close_redis, init_redis
from database.relational_db import UoW, dispose_engine, get_session_factory, wait_for_db
from scheduler import init_scheduler, stop_scheduler
from service.dev_seed import ensure_dev_seed
from service.media import get_media_storage_service


logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    enable_rate_limiter: bool = True,
    check_db_on_startup: bool = True,
    enable_scheduler: bool | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        scheduler = None
        try:
            if check_db_on_startup:
                await wait_for_db()

            redis = init_redis(settings)
            if enable_rate_limiter:
                await init_rate_limiters(app, redis)

            if settings.STORAGE_AUTO_CREATE_BUCKETS:
                storage = get_media_storage_service()
                await asyncio.to_thread(storage.ensure_buckets)
            else:
                storage = get_media_storage_service()

            if settings.DEV_SEED_ENABLED and settings.APP_STAGE != "prod":
                session_factory = get_session_factory(settings)
                async with session_factory() as session:
                    async with UoW(session) as uow:
                        await ensure_dev_seed(uow=uow, storage=storage, settings=settings)

            should_run_scheduler = (
                settings.SCHEDULER_ENABLED if enable_scheduler is None else enable_scheduler
            )
            if should_run_scheduler:
                scheduler = init_scheduler(settings)

            yield
        finally:
            stop_scheduler(scheduler)
            await close_redis()
            await dispose_engine()

    app = FastAPI(
        lifespan=lifespan,
        title="Backend Template",
        debug=settings.DEBUG if settings.DEBUG is not None else settings.APP_STAGE == "dev",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.enable_rate_limit = enable_rate_limiter
    app.add_middleware(RequestTracingMiddleware)
    register_exception_handlers(app, settings)

    app.include_router(get_api_routers())
    app.include_router(get_webhooks())


    # Checks
    @app.get("/api/ping")
    async def ping():
        return {"status": "ok"}

    @app.get("/api/health")
    async def health():
        dependencies: dict[str, str] = {}

        try:
            session_factory = get_session_factory(settings)
            async with session_factory() as session:
                await session.execute(text("SELECT 1"))
            dependencies["database"] = "ok"
        except Exception as exc:
            logger.warning("Database health check failed: %s", exc)
            dependencies["database"] = "error"

        try:
            redis = init_redis(settings)
            await redis.ping()
            dependencies["redis"] = "ok"
        except Exception as exc:
            logger.warning("Redis health check failed: %s", exc)
            dependencies["redis"] = "error"

        try:
            storage = get_media_storage_service()
            await asyncio.to_thread(storage.check_health)
            dependencies["storage"] = "ok"
        except Exception as exc:
            logger.warning("Storage health check failed: %s", exc)
            dependencies["storage"] = "error"

        return {
            "status": "ok" if all(value == "ok" for value in dependencies.values()) else "degraded",
            "timestamp": datetime.now(UTC).isoformat(),
            "version": settings.APP_VERSION,
            "dependencies": dependencies,
        }

    @app.get("/api/ready")
    async def readiness():
        checks: dict[str, str] = {}
        for attempt in range(2):
            checks = {}
            try:
                session_factory = get_session_factory(settings)
                async with session_factory() as session:
                    await session.execute(text("SELECT 1"))
                checks["database"] = "ok"
            except Exception as exc:
                logger.warning("Database readiness check failed: %s", exc)
                checks["database"] = "error"

            try:
                redis = init_redis(settings)
                await redis.ping()
                checks["redis"] = "ok"
            except Exception as exc:
                logger.warning("Redis readiness check failed: %s", exc)
                checks["redis"] = "error"

            try:
                storage = get_media_storage_service()
                await asyncio.to_thread(storage.check_health)
                checks["storage"] = "ok"
            except Exception as exc:
                logger.warning("Storage readiness check failed: %s", exc)
                checks["storage"] = "error"

            if all(value == "ok" for value in checks.values()):
                return {"status": "ready", "checks": checks}
            if attempt == 0:
                await asyncio.sleep(0.2)

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "checks": checks},
        )

    return app


app = create_app()
