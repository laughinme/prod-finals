from core.crypto import hash_password
from database.relational_db import RolesInterface, User, UserInterface
from domain.auth.enums import DEFAULT_ROLE
from service.mock_identity import MockIdentityRegistry

from .base import SeedContext


class AdminUserSeedTask:
    name = "admin_user"

    def __init__(self, *, registry: MockIdentityRegistry) -> None:
        self.registry = registry

    async def should_run(self, context: SeedContext) -> bool:
        return True

    async def run(self, context: SeedContext) -> None:
        user_repo = UserInterface(context.uow.session)
        role_repo = RolesInterface(context.uow.session)
        roles = await role_repo.get_by_slugs([DEFAULT_ROLE.value, "admin"])
        if len(roles) != 2:
            raise RuntimeError("Default member/admin roles are missing from the database")

        member_role, admin_role = roles
        password_hash = await hash_password(context.settings.MOCK_USER_SEED_PASSWORD)
        profile = self.registry.registration_profile(email="admin@example.com")

        user = await user_repo.get_by_service_user_id(profile.service_user_id)
        if user is None:
            user = await user_repo.get_by_email(profile.email)

        if user is None:
            user = User(
                email=profile.email,
                password_hash=password_hash,
            )
            await user_repo.add(user)
            await context.uow.session.flush()

        user.service_user_id = profile.service_user_id
        user.email = profile.email
        user.password_hash = password_hash
        user.first_name = profile.first_name
        user.last_name = profile.last_name
        user.birth_date = profile.birth_date
        user.gender = profile.gender
        user.bio = profile.bio
        user.city_id = "msk"
        user.is_dataset_user = False
        user.is_onboarded = False
        user.quiz_started = False
        user.looking_for_genders = []
        user.age_range_min = None
        user.age_range_max = None
        user.distance_km = None
        user.goal = None
        user.interests = []
        user.avatar_status = None
        user.avatar_rejection_reason = None
        await user_repo.assign_roles(user, [member_role, admin_role])
        await context.uow.commit()
