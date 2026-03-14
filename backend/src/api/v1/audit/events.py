from typing import Annotated

from fastapi import APIRouter, Depends, Query

from core.security import require
from database.relational_db import User
from domain.dating import AuditEventsQuery, AuditEventsResponse
from service.dating import AuditService, get_audit_service

router = APIRouter()


@router.get(
    "/events",
    response_model=AuditEventsResponse,
    summary="Read audit events by entity",
)
async def get_audit_events(
    _: Annotated[User, Depends(require("admin"))],
    svc: Annotated[AuditService, Depends(get_audit_service)],
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None, min_length=1),
    limit: int = Query(50, ge=1, le=200),
) -> AuditEventsResponse:
    return await svc.list_events(AuditEventsQuery(entity_type=entity_type, entity_id=entity_id, limit=limit))
