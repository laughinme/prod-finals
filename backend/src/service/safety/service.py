from datetime import timedelta
from uuid import UUID

from database.relational_db import Block, Conversation, Match, PairState, Report, User
from domain.dating import (
    AuditEntityType,
    BlockListResponse,
    BlockRequest,
    BlockResponse,
    BlockedUserItem,
    ConversationStatus,
    MatchStatus,
    ReportRequest,
    ReportResponse,
    UnblockResponse,
)
from domain.notifications import ConversationClosedEventPayload

from service.matchmaking import AlreadyBlockedError, BaseDatingService, InvalidSafetyTargetError


class SafetyService(BaseDatingService):
    async def list_blocks(self, *, actor: User) -> BlockListResponse:
        blocks = await self.matchmaking_repo.list_blocks_for_actor(actor_user_id=actor.id)
        if not blocks:
            return BlockListResponse(items=[])

        targets = await self.user_repo.list_by_ids([block.target_user_id for block in blocks])
        targets_by_id = {target.id: target for target in targets}
        items = [
            BlockedUserItem(
                block_id=block.id,
                target_user_id=block.target_user_id,
                display_name=(
                    targets_by_id[block.target_user_id].resolved_display_name
                    if block.target_user_id in targets_by_id
                    else "Unknown user"
                )
                or "Unknown user",
                avatar_url=targets_by_id[block.target_user_id].avatar_url
                if block.target_user_id in targets_by_id
                else None,
                blocked_at=block.created_at,
                reason_code=block.reason_code,
                source_context=block.source_context,
            )
            for block in blocks
        ]
        return BlockListResponse(items=items)

    async def unblock(self, *, actor: User, target_user_id: UUID) -> UnblockResponse:
        block = await self.matchmaking_repo.get_block(
            actor_user_id=actor.id,
            target_user_id=target_user_id,
        )
        if block is None:
            return UnblockResponse(status="unblocked", removed_from_blocklist=False)

        await self.matchmaking_repo.delete_block(block)
        pair_state = await self.matchmaking_repo.get_pair_state(actor.id, target_user_id)
        if (
            pair_state is not None
            and pair_state.status == "blocked"
            and pair_state.blocked_by_user_id == actor.id
        ):
            now = self.now()
            pair_state.status = "closed"
            pair_state.blocked_by_user_id = None
            if pair_state.cooldown_until is None or pair_state.cooldown_until < now:
                pair_state.cooldown_until = now + timedelta(days=self.cooldown_days)

        await self.add_audit_event(
            event_type="user_unblocked",
            entity_type=AuditEntityType.BLOCK,
            entity_id=str(block.id),
            actor_user_id=actor.id,
            payload={"target_user_id": str(target_user_id)},
        )
        await self.uow.commit()
        return UnblockResponse(status="unblocked", removed_from_blocklist=True)

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
        match = await self.uow.session.get(Match, pair_state.match_id) if pair_state.match_id else None
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
        await self.increment_funnel_counter(
            actor=actor,
            counter_name="user_blocked",
            decision_mode=match.source_decision_mode if match is not None else None,
        )
        if match is not None:
            await self.add_outbox_event(
                topic="ml.interactions.match_outcome",
                payload={
                    "match_id": str(match.id),
                    "user_a_id": actor.service_user_id or str(actor.id),
                    "user_b_id": target.service_user_id or str(target.id),
                    "outcome": "block_after_match",
                    "happened_at": self.now().isoformat(),
                },
            )
        await self.uow.commit()
        if conversation_closed and pair_state.conversation_id:
            conversation = await self.uow.session.get(Conversation, pair_state.conversation_id)
            if conversation is not None:
                await self.realtime_service.publish_conversation_closed(
                    conversation_id=conversation.id,
                    payload=ConversationClosedEventPayload(
                        conversation_id=conversation.id,
                        status=conversation.status,
                        closed_at=conversation.closed_at or self.now(),
                    ),
                )

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
        pair_state = await self.matchmaking_repo.get_or_create_pair_state(actor.id, target.id)
        match = await self.uow.session.get(Match, pair_state.match_id) if pair_state.match_id else None
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
        await self.increment_funnel_counter(
            actor=actor,
            counter_name="user_reported",
            decision_mode=match.source_decision_mode if match is not None else None,
        )
        if match is not None:
            await self.add_outbox_event(
                topic="ml.interactions.match_outcome",
                payload={
                    "match_id": str(match.id),
                    "user_a_id": actor.service_user_id or str(actor.id),
                    "user_b_id": target.service_user_id or str(target.id),
                    "outcome": "report_after_match",
                    "happened_at": self.now().isoformat(),
                },
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
