from fastapi import APIRouter


def get_safety_router() -> APIRouter:
    from .blocks import router as blocks_router
    from .reports import router as reports_router

    router = APIRouter(
        tags=["Safety"], responses={401: {"description": "Not authorized"}}
    )
    router.include_router(blocks_router)
    router.include_router(reports_router)
    return router
