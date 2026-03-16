from fastapi import APIRouter


def get_admins_router() -> APIRouter:
    from .users import get_users_router
    from .stats import get_stats_router
    from .experiments import router as experiments_router
    
    router = APIRouter(prefix='/admins', tags=['Admins'])

    router.include_router(get_users_router())
    router.include_router(get_stats_router())
    router.include_router(experiments_router)
    
    return router
