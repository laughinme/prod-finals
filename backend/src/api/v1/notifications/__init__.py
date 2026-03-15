from fastapi import APIRouter


def get_notifications_router() -> APIRouter:
    from .messages import router as messages_router
    from .matches import router as matches_router

    router = APIRouter(prefix="/notifications", tags=["Notifications"], responses={401: {"description": "Not authorized"}})
    router.include_router(matches_router)
    router.include_router(messages_router)
    return router
