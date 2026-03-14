from domain.dating import AuditEvent, AuditEventsQuery, AuditEventsResponse

from service.matchmaking import BaseDatingService


class AuditService(BaseDatingService):
    async def list_events(self, query: AuditEventsQuery) -> AuditEventsResponse:
        rows = await self.matchmaking_repo.list_audit_events(
            entity_type=query.entity_type,
            entity_id=query.entity_id,
            limit=query.limit,
        )
        return AuditEventsResponse(
            items=[
                AuditEvent(
                    event_id=row.id,
                    event_type=row.event_type,
                    entity_type=row.entity_type,
                    entity_id=row.entity_id,
                    actor_user_id=row.actor_user_id,
                    created_at=row.created_at,
                    payload=row.payload,
                )
                for row in rows
            ]
        )
