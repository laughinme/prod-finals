from fastapi import APIRouter


def get_moderation_router() -> APIRouter:
    from .reports import router as reports_router

    router = APIRouter(prefix="/moderation")
    router.include_router(reports_router)
    return router
