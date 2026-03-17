from fastapi import APIRouter


def get_matches_router() -> APIRouter:
    from .close import router as close_router
    from .list import router as list_router

    router = APIRouter(
        tags=["Matches"], responses={401: {"description": "Not authorized"}}
    )
    router.include_router(list_router, prefix="/matches")
    router.include_router(close_router, prefix="/matches")
    return router
