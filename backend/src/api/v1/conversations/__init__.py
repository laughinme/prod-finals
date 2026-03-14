from fastapi import APIRouter


def get_conversations_router() -> APIRouter:
    from .detail import router as detail_router
    from .messages import router as messages_router

    router = APIRouter(prefix="/conversations", tags=["Conversations"], responses={401: {"description": "Not authorized"}})
    router.include_router(detail_router)
    router.include_router(messages_router)
    return router
