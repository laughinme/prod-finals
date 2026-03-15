from datetime import timedelta

from sqlalchemy import select

from database.relational_db import Conversation, User
from domain.dating import (
    AuditEntityType,
    CloseMatchRequest,
    CloseMatchResponse,
    ConversationStatus,
    MatchListItem,
    MatchListResponse,
    MatchStatus,
)
from domain.notifications import ConversationClosedEventPayload

from service.matchmaking import BaseDatingService, InvalidMatchStateError, MatchNotFoundError


class MatchService(BaseDatingService):
    async def list_matches(self, user: User) -> MatchListResponse:
        rows = await self.matchmaking_repo.list_matches_for_user(user.id)
        items = [
            MatchListItem(
                match_id=match.id,
                candidate_user_id=peer.id,
                display_name=peer.resolved_display_name or "",
                avatar_url=peer.avatar_url,
                conversation_id=conversation.id if conversation else None,
                status=match.status,
                last_message_preview=last_message.text if last_message else None,
                last_message_at=last_message.created_at if last_message else None,
                unread_count=0,
            )
            for match, peer, conversation, last_message in rows
        ]
        return MatchListResponse(items=items)

    async def close_match(
        self,
        *,
        user: User,
        match_id,
        payload: CloseMatchRequest,
    ) -> CloseMatchResponse:
        match = await self.matchmaking_repo.get_match_for_user(match_id=match_id, user_id=user.id)
        if match is None:
            raise MatchNotFoundError()
        if match.status != MatchStatus.ACTIVE.value:
            raise InvalidMatchStateError()

        conversation = await self.uow.session.scalar(select(Conversation).where(Conversation.match_id == match.id))
        pair_state = await self.matchmaking_repo.get_or_create_pair_state(match.user_low_id, match.user_high_id)
        now = self.now()

        match.status = MatchStatus.CLOSED.value
        match.close_reason = payload.reason_code.value
        match.closed_at = now
        if conversation is not None:
            conversation.status = ConversationStatus.CLOSED_BY_USER.value
            conversation.closed_at = now

        pair_state.status = "closed"
        pair_state.cooldown_until = now + timedelta(days=self.cooldown_days)
        await self.add_audit_event(
            event_type="match_closed",
            entity_type=AuditEntityType.MATCH,
            entity_id=str(match.id),
            actor_user_id=user.id,
            payload={"reason_code": payload.reason_code.value},
        )
        await self.uow.commit()
        if conversation is not None:
            await self.realtime_service.publish_conversation_closed(
                conversation_id=conversation.id,
                payload=ConversationClosedEventPayload(
                    conversation_id=conversation.id,
                    status=conversation.status,
                    closed_at=conversation.closed_at or now,
                ),
            )

        return CloseMatchResponse(status="closed", removed_from_future_feed=True)
