import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from core.config import Settings, get_settings
from service.matchmaking import dispatch_ml_swipe_events

logger = logging.getLogger(__name__)


def init_scheduler(settings: Settings | None = None) -> AsyncIOScheduler | None:
    settings = settings or get_settings()
    ml_service_url = getattr(settings, "ML_SERVICE_URL", "")
    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler is disabled")
        return None

    scheduler = AsyncIOScheduler(
        timezone="UTC",
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 30,
        },
    )

    if ml_service_url:
        scheduler.add_job(
            dispatch_ml_swipe_events,
            trigger="interval",
            seconds=5,
            kwargs={"settings": settings},
            id="ml_swipe_outbox_dispatch",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("Scheduled ML swipe outbox dispatcher")

    scheduler.start()
    logger.info("Scheduler started")
    return scheduler


def stop_scheduler(scheduler: AsyncIOScheduler | None) -> None:
    if scheduler is None:
        return

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
