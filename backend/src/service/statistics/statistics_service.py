from datetime import UTC, date, datetime, timedelta

from database.relational_db import MatchmakingInterface, UoW, UserInterface
from domain.statistics import (
    FunnelConversionRates,
    FunnelCounts,
    FunnelDailyRow,
    FunnelDecisionMode,
    FunnelSegmentSummary,
    FunnelSummary,
    FunnelUserSource,
    RegistrationsGraph,
    UserStatsSummary,
)


class StatService:
    def __init__(
        self,
        uow: UoW,
        user_repo: UserInterface,
        matchmaking_repo: MatchmakingInterface,
    ):
        self.uow = uow
        self.user_repo = user_repo
        self.matchmaking_repo = matchmaking_repo

    async def users_summary(self) -> UserStatsSummary:
        now = datetime.now(UTC)
        since_24h = now - timedelta(hours=24)

        total_users = await self.user_repo.count_users()
        onboarded_users = await self.user_repo.count_users(onboarded=True)
        banned_users = await self.user_repo.count_users(banned=True)
        registered_last_24h = await self.user_repo.count_registered_since(since_24h)

        return UserStatsSummary(
            generated_at=now,
            total_users=total_users,
            onboarded_users=onboarded_users,
            banned_users=banned_users,
            registered_last_24h=registered_last_24h,
        )

    async def new_registrations(self, days: int) -> list[RegistrationsGraph]:
        raw_rows = await self.user_repo.registrations_by_days(days)

        graphs: list[RegistrationsGraph] = []
        for row in raw_rows:
            raw_day = row.get("day")
            if isinstance(raw_day, datetime):
                normalized_day = raw_day.date()
            elif isinstance(raw_day, date):
                normalized_day = raw_day
            else:
                normalized_day = date.fromisoformat(str(raw_day))

            graphs.append(
                RegistrationsGraph(
                    day=normalized_day,
                    count=int(row.get("count", 0)),
                )
            )

        return graphs

    async def funnel_summary(self) -> FunnelSummary:
        rows = await self.matchmaking_repo.list_funnel_rows()
        now = datetime.now(UTC)

        totals = self._sum_counts(rows)
        by_user_source = [
            self._build_segment_summary(
                rows=[row for row in rows if row.user_source == source.value],
                user_source=source,
                decision_mode=None,
            )
            for source in FunnelUserSource
        ]
        by_decision_mode = [
            self._build_segment_summary(
                rows=[row for row in rows if row.decision_mode == mode.value],
                user_source=None,
                decision_mode=mode,
            )
            for mode in FunnelDecisionMode
        ]
        by_segment: list[FunnelSegmentSummary] = []
        for source in FunnelUserSource:
            for mode in FunnelDecisionMode:
                segment_rows = [
                    row
                    for row in rows
                    if row.user_source == source.value
                    and row.decision_mode == mode.value
                ]
                by_segment.append(
                    self._build_segment_summary(
                        rows=segment_rows,
                        user_source=source,
                        decision_mode=mode,
                    )
                )

        return FunnelSummary(
            generated_at=now,
            totals=totals,
            conversions=self._build_conversions(totals),
            by_user_source=by_user_source,
            by_decision_mode=by_decision_mode,
            by_segment=by_segment,
        )

    async def funnel_daily(self, days: int) -> list[FunnelDailyRow]:
        days = max(1, days)
        since_day = datetime.now(UTC).date() - timedelta(days=days - 1)
        rows = await self.matchmaking_repo.list_funnel_rows(since_day=since_day)
        result: list[FunnelDailyRow] = []
        for row in rows:
            counts = FunnelCounts(
                feed_served=row.feed_served,
                feed_explanation_opened=row.feed_explanation_opened,
                feed_like=row.feed_like,
                feed_pass=row.feed_pass,
                feed_hide=row.feed_hide,
                match_created=row.match_created,
                chat_first_message_sent=row.chat_first_message_sent,
                chat_first_reply_received=row.chat_first_reply_received,
                match_closed=row.match_closed,
                user_blocked=row.user_blocked,
                user_reported=row.user_reported,
            )
            result.append(
                FunnelDailyRow(
                    day=row.day,
                    user_source=FunnelUserSource(row.user_source),
                    decision_mode=FunnelDecisionMode(row.decision_mode),
                    counts=counts,
                    conversions=self._build_conversions(counts),
                )
            )
        return result

    def _build_segment_summary(
        self,
        *,
        rows,
        user_source: FunnelUserSource | None,
        decision_mode: FunnelDecisionMode | None,
    ) -> FunnelSegmentSummary:
        counts = self._sum_counts(rows)
        return FunnelSegmentSummary(
            user_source=user_source,
            decision_mode=decision_mode,
            counts=counts,
            conversions=self._build_conversions(counts),
        )

    def _sum_counts(self, rows) -> FunnelCounts:
        return FunnelCounts(
            feed_served=sum(row.feed_served for row in rows),
            feed_explanation_opened=sum(row.feed_explanation_opened for row in rows),
            feed_like=sum(row.feed_like for row in rows),
            feed_pass=sum(row.feed_pass for row in rows),
            feed_hide=sum(row.feed_hide for row in rows),
            match_created=sum(row.match_created for row in rows),
            chat_first_message_sent=sum(row.chat_first_message_sent for row in rows),
            chat_first_reply_received=sum(
                row.chat_first_reply_received for row in rows
            ),
            match_closed=sum(row.match_closed for row in rows),
            user_blocked=sum(row.user_blocked for row in rows),
            user_reported=sum(row.user_reported for row in rows),
        )

    def _build_conversions(self, counts: FunnelCounts) -> FunnelConversionRates:
        negative_outcomes = (
            counts.match_closed + counts.user_blocked + counts.user_reported
        )
        return FunnelConversionRates(
            like_rate=self._ratio(counts.feed_like, counts.feed_served),
            match_rate_from_likes=self._ratio(counts.match_created, counts.feed_like),
            first_message_rate_from_matches=self._ratio(
                counts.chat_first_message_sent,
                counts.match_created,
            ),
            first_reply_rate_from_first_messages=self._ratio(
                counts.chat_first_reply_received,
                counts.chat_first_message_sent,
            ),
            negative_outcome_rate_from_matches=self._ratio(
                negative_outcomes, counts.match_created
            ),
        )

    def _ratio(self, numerator: int, denominator: int) -> float:
        if denominator <= 0:
            return 0.0
        return round(numerator / denominator, 4)
