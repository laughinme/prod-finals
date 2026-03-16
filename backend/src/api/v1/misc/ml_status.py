from typing import Annotated

from fastapi import APIRouter, Depends

from domain.misc import MlConnectionStatusModel
from service.matchmaking import MlFacade, get_ml_facade


router = APIRouter()


@router.get(
    path="/ml-status",
    response_model=MlConnectionStatusModel,
    summary="Check backend connectivity to ML service",
)
async def get_ml_status(
    ml_facade: Annotated[MlFacade, Depends(get_ml_facade)],
) -> MlConnectionStatusModel:
    return await ml_facade.connection_status()

