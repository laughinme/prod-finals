from fastapi import APIRouter


def get_onboarding_router() -> APIRouter:
    from .finish import router as finish_router
    from .state import router as state_router

    router = APIRouter(prefix="/onboarding", tags=["Onboarding"], responses={401: {"description": "Not authorized"}})
    router.include_router(state_router)
    router.include_router(finish_router)
    return router
