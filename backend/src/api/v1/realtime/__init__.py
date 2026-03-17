from fastapi import APIRouter


def get_realtime_router() -> APIRouter:
    from .connection import router as connection_router

    router = APIRouter(
        prefix="/realtime",
        tags=["Realtime"],
        responses={401: {"description": "Not authorized"}},
    )
    router.include_router(connection_router)
    return router
