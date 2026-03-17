from fastapi import APIRouter


def get_feed_router() -> APIRouter:
    from .list import router as list_router
    from .reactions import router as reactions_router

    router = APIRouter(
        tags=["Feed"], responses={401: {"description": "Not authorized"}}
    )
    router.include_router(list_router, prefix="/feed")
    router.include_router(reactions_router, prefix="/feed")
    return router
