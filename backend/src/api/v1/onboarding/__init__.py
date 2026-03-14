from fastapi import APIRouter


def get_onboarding_router() -> APIRouter:
    from .answers import router as answers_router
    from .config import router as config_router
    from .finish import router as finish_router
    from .resume import router as resume_router
    from .skip import router as skip_router
    from .state import router as state_router

    router = APIRouter(prefix="/onboarding", tags=["Onboarding"], responses={401: {"description": "Not authorized"}})
    router.include_router(state_router)
    router.include_router(config_router)
    router.include_router(answers_router)
    router.include_router(skip_router)
    router.include_router(resume_router)
    router.include_router(finish_router)
    return router
