from fastapi import APIRouter


def get_v1_router() -> APIRouter:
    from .auth import get_auth_routers
    from .audit import get_audit_router
    from .conversations import get_conversations_router
    from .feed import get_feed_router
    from .matches import get_matches_router
    from .users import get_users_router
    from .misc import get_misc_router
    from .notifications import get_notifications_router
    from .onboarding import get_onboarding_router
    from .realtime import get_realtime_router
    from .safety import get_safety_router
    from .admins import get_admins_router
    
    router = APIRouter(prefix='/v1')

    router.include_router(get_auth_routers())
    router.include_router(get_users_router())
    router.include_router(get_onboarding_router())
    router.include_router(get_feed_router())
    router.include_router(get_matches_router())
    router.include_router(get_conversations_router())
    router.include_router(get_notifications_router())
    router.include_router(get_realtime_router())
    router.include_router(get_safety_router())
    router.include_router(get_audit_router())
    router.include_router(get_misc_router())
    router.include_router(get_admins_router())
    
    return router
