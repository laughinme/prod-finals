from .base import BaseDatingService, normalize_pair
from .dependencies import (
    build_matchmaking_common,
    get_matchmaking_common,
    get_ml_facade,
)
from .exceptions import *
from .ml_facade import HttpMlFacade, MlFacade, MockMlFacade, _age_for_birth_date
from .outbox_dispatcher import (
    dispatch_ml_match_outcome_events,
    dispatch_ml_swipe_events,
)
