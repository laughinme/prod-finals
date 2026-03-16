from fastapi import APIRouter


def get_misc_router() -> APIRouter:
    from .languages import get_languages_router
    from .ml_status import router as ml_status_router

    router = APIRouter()

    router.include_router(get_languages_router())
    router.include_router(ml_status_router)

    return router
