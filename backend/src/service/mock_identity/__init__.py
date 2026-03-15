from functools import lru_cache

from .registry import INTEREST_OPTIONS, MockIdentityProfile, MockIdentityRegistry
from .service import MockIdentityService


@lru_cache
def get_mock_identity_registry() -> MockIdentityRegistry:
    return MockIdentityRegistry.from_default_source()
