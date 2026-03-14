from fastapi import Depends

from service.matchmaking import get_matchmaking_common

from .service import AuditService


async def get_audit_service(common: dict = Depends(get_matchmaking_common)) -> AuditService:
    return AuditService(**common)


__all__ = ["AuditService", "get_audit_service"]
