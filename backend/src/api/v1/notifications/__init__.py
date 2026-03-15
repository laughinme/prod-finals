from fastapi import APIRouter


def get_notifications_router() -> APIRouter:
    from .matches import router as matches_router

    router = APIRouter(prefix="/notifications", tags=["Notifications"], responses={401: {"description": "Not authorized"}})
    router.include_router(matches_router)
    return router
