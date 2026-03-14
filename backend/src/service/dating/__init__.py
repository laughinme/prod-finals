from fastapi import Depends

from database.relational_db import DatingInterface, UoW, UserInterface, get_uow
from .ml_facade import MlFacade, MockMlFacade
from .services import (
    AuditService,
    ConversationService,
    FeedService,
    InteractionService,
    MatchService,
    OnboardingService,
    SafetyService,
)


def get_ml_facade() -> MlFacade:
    return MockMlFacade()


def _build_common(uow: UoW, ml_facade: MlFacade):
    return {
        "uow": uow,
        "user_repo": UserInterface(uow.session),
        "dating_repo": DatingInterface(uow.session),
        "ml_facade": ml_facade,
    }


async def get_onboarding_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> OnboardingService:
    return OnboardingService(**_build_common(uow, ml_facade))


async def get_feed_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> FeedService:
    return FeedService(**_build_common(uow, ml_facade))


async def get_interaction_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> InteractionService:
    return InteractionService(**_build_common(uow, ml_facade))


async def get_match_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> MatchService:
    return MatchService(**_build_common(uow, ml_facade))


async def get_conversation_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> ConversationService:
    return ConversationService(**_build_common(uow, ml_facade))


async def get_safety_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> SafetyService:
    return SafetyService(**_build_common(uow, ml_facade))


async def get_audit_service(
    uow: UoW = Depends(get_uow),
    ml_facade: MlFacade = Depends(get_ml_facade),
) -> AuditService:
    return AuditService(**_build_common(uow, ml_facade))
