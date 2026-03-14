from fastapi import APIRouter


def get_audit_router() -> APIRouter:
    from .events import router as events_router

    router = APIRouter(prefix="/audit", tags=["Audit"], responses={401: {"description": "Not authorized"}})
    router.include_router(events_router)
    return router
