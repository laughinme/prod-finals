from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from ..audit import AuditLog, OutboxEvent
from ..conversations import Conversation, Message
from ..feed import InteractionEvent, RecommendationBatch, RecommendationItem
from ..matches import Match, PairState
from ..onboarding import OnboardingQuizAnswer
from ..safety import Block, Report
from ..users import User


class MatchmakingInterface:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, instance):
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def get_active_batch_for_date(
        self,
        *,
        user_id: UUID,
        batch_date: date,
    ) -> RecommendationBatch | None:
        stmt = (
            select(RecommendationBatch)
            .where(
                RecommendationBatch.user_id == user_id,
                RecommendationBatch.batch_date == batch_date,
            )
        )
        return await self.session.scalar(stmt)

    async def reset_batch_for_date(
        self,
        *,
        user_id: UUID,
        batch_date: date,
    ) -> None:
        batch = await self.get_active_batch_for_date(user_id=user_id, batch_date=batch_date)
        if batch is None:
            return
        await self.session.execute(
            delete(RecommendationItem).where(RecommendationItem.batch_id == batch.id)
        )
        await self.session.execute(delete(RecommendationBatch).where(RecommendationBatch.id == batch.id))
        await self.session.flush()

    async def list_batch_items(self, batch_id: UUID) -> list[RecommendationItem]:
        rows = await self.session.scalars(
            select(RecommendationItem)
            .where(RecommendationItem.batch_id == batch_id)
            .order_by(RecommendationItem.rank.asc())
        )
        return list(rows.all())

    async def get_recommendation_item_for_user(
        self,
        *,
        serve_item_id: UUID,
        owner_user_id: UUID,
    ) -> RecommendationItem | None:
        stmt = (
            select(RecommendationItem)
            .join(RecommendationBatch, RecommendationBatch.id == RecommendationItem.batch_id)
            .where(
                RecommendationItem.id == serve_item_id,
                RecommendationBatch.user_id == owner_user_id,
            )
        )
        return await self.session.scalar(stmt)

    async def list_feed_candidates(
        self,
        *,
        requester_id: UUID,
    ) -> list[User]:
        rows = await self.session.scalars(
            select(User)
            .options(selectinload(User.roles), selectinload(User.city))
            .where(User.id != requester_id, User.banned.is_(False))
            .order_by(User.created_at.asc())
        )
        return list(rows.all())

    async def get_pair_state(self, user_a_id: UUID, user_b_id: UUID) -> PairState | None:
        low_id, high_id = sorted((user_a_id, user_b_id))
        return await self.session.scalar(
            select(PairState).where(
                PairState.user_low_id == low_id,
                PairState.user_high_id == high_id,
            )
        )

    async def get_or_create_pair_state(self, user_a_id: UUID, user_b_id: UUID) -> PairState:
        pair_state = await self.get_pair_state(user_a_id, user_b_id)
        if pair_state is not None:
            return pair_state
        low_id, high_id = sorted((user_a_id, user_b_id))
        pair_state = PairState(user_low_id=low_id, user_high_id=high_id)
        self.session.add(pair_state)
        await self.session.flush()
        return pair_state

    async def get_existing_interaction(
        self,
        *,
        actor_user_id: UUID,
        serve_item_id: UUID,
    ) -> InteractionEvent | None:
        return await self.session.scalar(
            select(InteractionEvent).where(
                InteractionEvent.actor_user_id == actor_user_id,
                InteractionEvent.serve_item_id == serve_item_id,
            )
        )

    async def get_match_for_users(self, user_a_id: UUID, user_b_id: UUID) -> Match | None:
        low_id, high_id = sorted((user_a_id, user_b_id))
        return await self.session.scalar(
            select(Match).where(Match.user_low_id == low_id, Match.user_high_id == high_id)
        )

    async def list_matches_for_user(self, user_id: UUID) -> list[tuple[Match, User, Conversation | None, Message | None]]:
        peer = aliased(User)
        last_message_at_subq = (
            select(
                Message.conversation_id.label("conversation_id"),
                func.max(Message.created_at).label("last_created_at"),
            )
            .group_by(Message.conversation_id)
            .subquery()
        )
        last_message = aliased(Message)
        stmt = (
            select(Match, peer, Conversation, last_message)
            .join(
                peer,
                or_(
                    and_(Match.user_low_id == user_id, peer.id == Match.user_high_id),
                    and_(Match.user_high_id == user_id, peer.id == Match.user_low_id),
                ),
            )
            .join(Conversation, Conversation.match_id == Match.id, isouter=True)
            .join(
                last_message_at_subq,
                last_message_at_subq.c.conversation_id == Conversation.id,
                isouter=True,
            )
            .join(
                last_message,
                and_(
                    last_message.conversation_id == Conversation.id,
                    last_message.created_at == last_message_at_subq.c.last_created_at,
                ),
                isouter=True,
            )
            .where(or_(Match.user_low_id == user_id, Match.user_high_id == user_id))
            .order_by(Match.updated_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.all())

    async def get_match_for_user(self, *, match_id: UUID, user_id: UUID) -> Match | None:
        return await self.session.scalar(
            select(Match).where(
                Match.id == match_id,
                or_(Match.user_low_id == user_id, Match.user_high_id == user_id),
            )
        )

    async def get_conversation_for_user(
        self,
        *,
        conversation_id: UUID,
        user_id: UUID,
    ) -> tuple[Conversation, Match, User] | None:
        peer = aliased(User)
        stmt = (
            select(Conversation, Match, peer)
            .join(Match, Match.id == Conversation.match_id)
            .join(
                peer,
                or_(
                    and_(Match.user_low_id == user_id, peer.id == Match.user_high_id),
                    and_(Match.user_high_id == user_id, peer.id == Match.user_low_id),
                ),
            )
            .where(
                Conversation.id == conversation_id,
                or_(Match.user_low_id == user_id, Match.user_high_id == user_id),
            )
        )
        result = await self.session.execute(stmt)
        row = result.first()
        if row is None:
            return None
        return row

    async def list_messages(
        self,
        *,
        conversation_id: UUID,
        cursor: datetime | None,
        limit: int,
    ) -> list[Message]:
        stmt = select(Message).where(Message.conversation_id == conversation_id)
        if cursor is not None:
            stmt = stmt.where(Message.created_at < cursor)
        stmt = stmt.order_by(Message.created_at.desc()).limit(limit + 1)
        rows = await self.session.scalars(stmt)
        return list(rows.all())

    async def get_existing_message(
        self,
        *,
        conversation_id: UUID,
        client_message_id: UUID,
    ) -> Message | None:
        return await self.session.scalar(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.client_message_id == client_message_id,
            )
        )

    async def get_block(self, *, actor_user_id: UUID, target_user_id: UUID) -> Block | None:
        return await self.session.scalar(
            select(Block).where(
                Block.actor_user_id == actor_user_id,
                Block.target_user_id == target_user_id,
            )
        )

    async def get_existing_report(
        self,
        *,
        actor_user_id: UUID,
        client_event_id: UUID | None,
    ) -> Report | None:
        if client_event_id is None:
            return None
        return await self.session.scalar(
            select(Report).where(
                Report.actor_user_id == actor_user_id,
                Report.client_event_id == client_event_id,
            )
        )

    async def list_quiz_answers(self, *, user_id: UUID) -> list[OnboardingQuizAnswer]:
        rows = await self.session.scalars(
            select(OnboardingQuizAnswer)
            .where(OnboardingQuizAnswer.user_id == user_id)
            .order_by(OnboardingQuizAnswer.updated_at.asc(), OnboardingQuizAnswer.step_key.asc())
        )
        return list(rows.all())

    async def get_quiz_answer(self, *, user_id: UUID, step_key: str) -> OnboardingQuizAnswer | None:
        return await self.session.scalar(
            select(OnboardingQuizAnswer).where(
                OnboardingQuizAnswer.user_id == user_id,
                OnboardingQuizAnswer.step_key == step_key,
            )
        )

    async def upsert_quiz_answer(
        self,
        *,
        user_id: UUID,
        step_key: str,
        answers: list[str],
    ) -> OnboardingQuizAnswer:
        record = await self.get_quiz_answer(user_id=user_id, step_key=step_key)
        if record is None:
            record = OnboardingQuizAnswer(user_id=user_id, step_key=step_key, answers=answers)
            self.session.add(record)
        else:
            record.answers = answers
        await self.session.flush()
        return record

    async def list_audit_events(
        self,
        *,
        entity_type: str | None,
        entity_id: str | None,
        limit: int,
    ) -> list[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        if entity_type is not None:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
        rows = await self.session.scalars(stmt)
        return list(rows.all())

    async def list_excluded_target_ids_for_user(self, user_id: UUID) -> set[UUID]:
        blocked_rows = await self.session.scalars(
            select(Block.target_user_id).where(Block.actor_user_id == user_id)
        )
        blocked_by_rows = await self.session.scalars(
            select(Block.actor_user_id).where(Block.target_user_id == user_id)
        )
        pair_rows = await self.session.scalars(
            select(PairState).where(
                or_(PairState.user_low_id == user_id, PairState.user_high_id == user_id)
            )
        )
        excluded = set(blocked_rows.all()) | set(blocked_by_rows.all())
        now = datetime.now(UTC)
        for pair in pair_rows.all():
            target_id = pair.user_high_id if pair.user_low_id == user_id else pair.user_low_id
            if pair.status in {"blocked", "hidden"}:
                excluded.add(target_id)
                continue
            if pair.status in {"conversation_active", "matched"}:
                excluded.add(target_id)
                continue
            if pair.cooldown_until and pair.cooldown_until > now:
                excluded.add(target_id)
        return excluded

    async def list_ready_users(self) -> list[User]:
        rows = await self.session.scalars(
            select(User)
            .options(selectinload(User.roles), selectinload(User.city))
            .where(User.banned.is_(False))
            .order_by(User.created_at.asc())
        )
        return list(rows.all())

    async def claim_pending_outbox_events(
        self,
        *,
        topic: str,
        limit: int,
        now: datetime | None = None,
    ) -> list[OutboxEvent]:
        now = now or datetime.now(UTC)
        stmt = (
            select(OutboxEvent)
            .where(
                OutboxEvent.topic == topic,
                OutboxEvent.status == "pending",
                or_(OutboxEvent.available_at.is_(None), OutboxEvent.available_at <= now),
            )
            .order_by(OutboxEvent.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        rows = await self.session.scalars(stmt)
        events = list(rows.all())
        for event in events:
            event.status = "processing"
        await self.session.flush()
        return events

    async def update_outbox_event(
        self,
        *,
        event_id: UUID,
        status: str,
        available_at: datetime | None = None,
    ) -> OutboxEvent | None:
        event = await self.session.get(OutboxEvent, event_id)
        if event is None:
            return None
        event.status = status
        event.available_at = available_at
        await self.session.flush()
        return event
