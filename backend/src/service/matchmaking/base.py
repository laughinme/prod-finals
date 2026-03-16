from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from core.config import Settings, get_settings
from database.relational_db import (
    AuditLog,
    MatchmakingInterface,
    NotificationInterface,
    OutboxEvent,
    UoW,
    User,
    UserInterface,
)
from domain.dating import AuditEntityType, FeedCandidateContext, FeedLockReason, ProfileStatus
from domain.statistics import FunnelDecisionMode, FunnelUserSource
from service.realtime import RealtimeService

from .ml_facade import MlFacade


def normalize_pair(user_a_id, user_b_id):
    return tuple(sorted((user_a_id, user_b_id)))


class BaseDatingService:
    def __init__(
        self,
        *,
        uow: UoW,
        user_repo: UserInterface,
        matchmaking_repo: MatchmakingInterface,
        notification_repo: NotificationInterface,
        realtime_service: RealtimeService,
        ml_facade: MlFacade,
        settings: Settings | None = None,
    ):
        self.uow = uow
        self.user_repo = user_repo
        self.matchmaking_repo = matchmaking_repo
        self.notification_repo = notification_repo
        self.realtime_service = realtime_service
        self.ml_facade = ml_facade
        self.settings = settings or get_settings()
        self._tz = ZoneInfo(self.settings.APP_TIMEZONE)
        self.cooldown_days = self.settings.PAIR_COOLDOWN_DAYS

    def local_today(self) -> date:
        return datetime.now(self._tz).date()

    def local_end_of_day(self) -> datetime:
        tomorrow = self.local_today() + timedelta(days=1)
        end_local = datetime.combine(tomorrow, datetime.min.time(), tzinfo=self._tz)
        return end_local.astimezone(UTC)

    def now(self) -> datetime:
        return datetime.now(UTC)

    async def _build_feed_context(self, user: User) -> FeedCandidateContext:
        return FeedCandidateContext(
            user_id=user.id,
            ml_user_id=user.service_user_id,
            display_name=user.resolved_display_name or "",
            birth_date=user.birth_date,
            city=user.city.name if user.city else None,
            gender=user.gender,
            search_preferences={
                "looking_for_genders": list(user.looking_for_genders or []),
                "age_range": user.age_range,
                "distance_km": user.distance_km,
                "goal": user.goal,
            },
            interests=list(user.interests or []),
            bio=user.bio,
            avatar_url=user.avatar_url,
            profile_completion_percent=user.profile_completion_percent,
        )

    def _build_lock_reason(self, user: User) -> FeedLockReason | None:
        if user.profile_status == ProfileStatus.BLOCKED.value:
            return FeedLockReason.BLOCKED
        if user.profile_status == ProfileStatus.REQUIRED_FIELDS_MISSING.value:
            return FeedLockReason.REQUIRED_FIELDS_MISSING
        if user.profile_status == ProfileStatus.AVATAR_PENDING.value:
            return FeedLockReason.AVATAR_PENDING
        if user.profile_status == ProfileStatus.AVATAR_REQUIRED.value:
            return FeedLockReason.AVATAR_REQUIRED
        return None

    async def add_audit_event(
        self,
        *,
        event_type: str,
        entity_type: AuditEntityType,
        entity_id: str,
        actor_user_id,
        payload: dict,
    ) -> AuditLog:
        return await self.matchmaking_repo.add(
            AuditLog(
                event_type=event_type,
                entity_type=entity_type.value,
                entity_id=str(entity_id),
                actor_user_id=actor_user_id,
                payload=payload,
            )
        )

    async def add_outbox_event(self, *, topic: str, payload: dict) -> OutboxEvent:
        return await self.matchmaking_repo.add(OutboxEvent(topic=topic, payload=payload, status="pending"))

    def funnel_user_source(self, user: User) -> FunnelUserSource:
        return FunnelUserSource.DATASET if bool(user.is_dataset_user) else FunnelUserSource.COLD_START

    def funnel_decision_mode(self, raw: str | None) -> FunnelDecisionMode:
        normalized = (raw or "").strip().lower()
        if normalized == "model":
            return FunnelDecisionMode.MODEL
        if normalized == "fallback":
            return FunnelDecisionMode.FALLBACK
        return FunnelDecisionMode.UNKNOWN

    async def increment_funnel_counter(
        self,
        *,
        actor: User,
        counter_name: str,
        decision_mode: str | None,
    ) -> None:
        await self.matchmaking_repo.increment_daily_funnel_counter(
            day=self.local_today(),
            user_source=self.funnel_user_source(actor).value,
            decision_mode=self.funnel_decision_mode(decision_mode).value,
            counter_name=counter_name,
            now=self.now(),
        )
