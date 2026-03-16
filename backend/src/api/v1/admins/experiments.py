from typing import Annotated

from fastapi import APIRouter, Depends

from core.security import require
from database.relational_db import User
from domain.misc import RandomMixConfigModel, RandomMixConfigUpdateModel
from service.matchmaking.random_mix import get_random_mix_state, set_random_mix_percent

router = APIRouter(prefix="/experiments")


@router.get(
    "/random-mix",
    response_model=RandomMixConfigModel,
    summary="Get random recommendation mix percent for admin experiments",
)
async def get_random_mix_config(
    _: Annotated[User, Depends(require("admin"))],
) -> RandomMixConfigModel:
    state = get_random_mix_state()
    return RandomMixConfigModel(
        random_mix_percent=state.random_mix_percent,
        updated_at=state.updated_at,
    )


@router.put(
    "/random-mix",
    response_model=RandomMixConfigModel,
    summary="Update random recommendation mix percent for admin experiments",
)
async def update_random_mix_config(
    payload: RandomMixConfigUpdateModel,
    _: Annotated[User, Depends(require("admin"))],
) -> RandomMixConfigModel:
    state = set_random_mix_percent(payload.random_mix_percent)
    return RandomMixConfigModel(
        random_mix_percent=state.random_mix_percent,
        updated_at=state.updated_at,
    )
