from fastapi import APIRouter


def get_stats_router() -> APIRouter:
    from .funnel import router as funnel_router
    from .users import router as users_router

    router = APIRouter(prefix="/stats")

    router.include_router(users_router)
    router.include_router(funnel_router)

    return router
