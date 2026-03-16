from uuid import uuid4

import pytest

from domain.dating import CompatibilityReasonCode, RankedCandidate
from service.matchmaking.random_mix import RandomMixController, apply_random_mix


def _candidate(score: float) -> RankedCandidate:
    return RankedCandidate(
        candidate_user_id=uuid4(),
        score=score,
        reason_codes=[CompatibilityReasonCode.PROFILE_QUALITY],
    )


@pytest.mark.unit
def test_random_mix_controller_clamps_value():
    controller = RandomMixController(initial_percent=-10)
    assert controller.snapshot().random_mix_percent == 0

    state = controller.set_percent(120)
    assert state.random_mix_percent == 80


@pytest.mark.unit
def test_apply_random_mix_preserves_candidate_set_and_count():
    ranked = [_candidate(score=0.99 - index * 0.01) for index in range(30)]
    mixed = apply_random_mix(ranked, mix_percent=40)

    assert len(mixed) == len(ranked)
    assert {item.candidate_user_id for item in mixed} == {
        item.candidate_user_id for item in ranked
    }
    assert mixed[0].candidate_user_id == ranked[0].candidate_user_id
