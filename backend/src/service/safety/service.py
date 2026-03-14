from database.relational_db import Block, Conversation, Match, PairState, Report, User
from domain.dating import (
    AuditEntityType,
    BlockRequest,
    BlockResponse,
    ConversationStatus,
    MatchStatus,
    ReportRequest,
    ReportResponse,
)

from service.matchmaking import AlreadyBlockedError, BaseDatingService, InvalidSafetyTargetError


class SafetyService(BaseDatingService):
    async def block(self, *, actor: User, payload: BlockRequest) -> BlockResponse:
        target = await self.user_repo.get_by_id(payload.target_user_id)
        if target is None or target.id == actor.id:
            raise InvalidSafetyTargetError()

        existing = await self.matchmaking_repo.get_block(actor_user_id=actor.id, target_user_id=target.id)
        if existing is not None:
            return BlockResponse(
                status="blocked",
                removed_from_future_feed=True,
                conversation_closed=False,
                match_closed=False,
            )

        block = await self.matchmaking_repo.add(
            Block(
                actor_user_id=actor.id,
                target_user_id=target.id,
                source_context=payload.source_context.value,
                reason_code=payload.reason_code.value,
            )
        )
        pair_state = await self.matchmaking_repo.get_or_create_pair_state(actor.id, target.id)
        pair_state.status = "blocked"
        pair_state.blocked_by_user_id = actor.id

        conversation_closed, match_closed = await self._close_related_pair_entities(pair_state, reason="blocked")
        await self.add_audit_event(
            event_type="user_blocked",
            entity_type=AuditEntityType.BLOCK,
            entity_id=str(block.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(target.id), "reason_code": payload.reason_code.value},
        )
        await self.uow.commit()

        return BlockResponse(
            status="blocked",
            removed_from_future_feed=True,
            conversation_closed=conversation_closed,
            match_closed=match_closed,
        )

    async def report(self, *, actor: User, payload: ReportRequest) -> ReportResponse:
        target = await self.user_repo.get_by_id(payload.target_user_id)
        if target is None or target.id == actor.id:
            raise InvalidSafetyTargetError()

        report = await self.matchmaking_repo.add(
            Report(
                actor_user_id=actor.id,
                target_user_id=target.id,
                source_context=payload.source_context.value,
                category=payload.category.value,
                description=payload.description,
                related_message_id=str(payload.related_message_id) if payload.related_message_id else None,
                also_block=payload.also_block,
            )
        )
        also_block_applied = False
        if payload.also_block:
            try:
                await self.block(
                    actor=actor,
                    payload=BlockRequest(
                        target_user_id=payload.target_user_id,
                        source_context=payload.source_context,
                        reason_code="other",
                    ),
                )
            except AlreadyBlockedError:
                pass
            also_block_applied = True

        await self.add_audit_event(
            event_type="user_reported",
            entity_type=AuditEntityType.REPORT,
            entity_id=str(report.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(target.id), "category": payload.category.value},
        )
        await self.uow.commit()

        return ReportResponse(
            report_id=report.id,
            status="accepted",
            also_block_applied=also_block_applied,
        )

    async def _close_related_pair_entities(self, pair_state: PairState, *, reason: str) -> tuple[bool, bool]:
        match_closed = False
        conversation_closed = False
        now = self.now()
        if pair_state.match_id:
            match = await self.uow.session.get(Match, pair_state.match_id)
            if match is not None and match.status != MatchStatus.BLOCKED.value:
                match.status = MatchStatus.BLOCKED.value
                match.close_reason = reason
                match.closed_at = now
                match_closed = True
        if pair_state.conversation_id:
            conversation = await self.uow.session.get(Conversation, pair_state.conversation_id)
            if conversation is not None and conversation.status != ConversationStatus.CLOSED_BY_BLOCK.value:
                conversation.status = ConversationStatus.CLOSED_BY_BLOCK.value
                conversation.closed_at = now
                conversation_closed = True
        return conversation_closed, match_closed
