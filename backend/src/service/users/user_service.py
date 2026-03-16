import asyncio
from datetime import datetime
from uuid import UUID

from core.config import get_settings
# from core.rbac import permissions_cache_key
from database.redis import CacheRepo
from database.relational_db import (
    CitiesInterface,
    LanguagesInterface,
    MatchmakingInterface,
    RolesInterface,
    User,
    UserInterface,
    UoW,
)
from domain.dating import (
    AgeRange,
    AvatarModerationStatus,
    AvatarResponse,
    SearchPreferences,
)
from domain.users.schemas.avatar import AvatarPresignResponse
from domain.users.schemas.profile import UserPatch
from domain.users.schemas.profile import UserModel
from service.media import ALLOWED_AVATAR_CONTENT_TYPES, MediaStorageService
from service.matchmaking.ml_facade import MlFacade
from .exceptions import (
    AvatarObjectNotFoundError,
    AvatarTooLargeError,
    AvatarUnsupportedContentTypeError,
    CityNotFoundError,
    InvalidAvatarObjectKeyError,
    InvalidCursorError,
    UnknownRolesError,
    UnsupportedAvatarContentTypeError,
)


class UserService:
    def __init__(
        self,
        uow: UoW,
        user_repo: UserInterface,
        lang_repo: LanguagesInterface,
        role_repo: RolesInterface,
        media_storage: MediaStorageService,
        city_repo: CitiesInterface | None = None,
        matchmaking_repo: MatchmakingInterface | None = None,
        ml_facade: MlFacade | None = None,
        cache_repo: CacheRepo | None = None,
    ):
        self.uow = uow
        self.user_repo = user_repo
        self.city_repo = city_repo
        self.matchmaking_repo = matchmaking_repo
        self.lang_repo = lang_repo
        self.role_repo = role_repo
        self.media_storage = media_storage
        self.ml_facade = ml_facade
        self.cache_repo = cache_repo
        self.settings = get_settings()
        
    async def get_user(self, user_id: UUID | str) -> User | None:
        return await self.user_repo.get_by_id(user_id)

    async def get_user_by_demo_key(self, demo_user_key: str) -> User | None:
        return await self.user_repo.get_by_demo_user_key(demo_user_key)

    async def serialize_user(self, user: User) -> UserModel:
        import_transactions = await self._get_import_transactions_value(user.id)
        city = user.city
        if city is None and user.city_id and self.city_repo is not None:
            city = await self.city_repo.get_by_id(user.city_id)
        return UserModel(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            avatar_key=user.avatar_key,
            avatar_url=user.avatar_url,
            avatar_status=self._build_legacy_avatar_status(user),
            avatar_rejection_reason=user.avatar_rejection_reason,
            birth_date=user.birth_date,
            city={"id": city.id, "name": city.name} if city else None,
            gender=user.gender,
            bio=user.bio,
            looking_for_genders=list(user.looking_for_genders or []),
            age_range=AgeRange(**user.age_range) if user.age_range else None,
            distance_km=user.distance_km,
            goal=self._build_legacy_goal(user.goal),
            interests=list(user.interests or []),
            import_transactions=import_transactions,
            quiz_started=user.quiz_started,
            is_onboarded=user.can_open_feed,
            onboarding_status=user.onboarding_status,
            has_min_profile=user.has_min_profile,
            missing_required_fields=list(user.missing_required_fields),
            required_profile_step_key=user.required_profile_step_key,
            has_approved_photo=user.has_approved_photo,
            profile_status=user.profile_status,
            banned=user.banned,
            role_slugs=user.role_slugs,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    async def patch_user(self, payload: UserPatch, user: User) -> User:
        data = payload.model_dump(exclude_unset=True)
        should_reset_feed_batch = False
        should_sync_ml_preferences = False
        should_sync_preferences_answers = False
        import_transactions = data.pop("import_transactions", None)

        if "city_id" in data:
            if self.city_repo is None:
                raise CityNotFoundError()
            city = await self.city_repo.get_by_id(data["city_id"])
            if city is None:
                raise CityNotFoundError()
            user.city_id = city.id
            data.pop("city_id")

        if "city" in data:
            if self.city_repo is None:
                raise CityNotFoundError()
            city = await self.city_repo.get_by_name(data["city"])
            if city is None:
                raise CityNotFoundError()
            user.city_id = city.id
            data.pop("city")

        search_preferences = data.pop("search_preferences", None)
        if search_preferences is not None:
            prefs = search_preferences
            if "looking_for_genders" in prefs:
                user.looking_for_genders = [
                    value.value if hasattr(value, "value") else value
                    for value in (prefs["looking_for_genders"] or [])
                ]
                should_reset_feed_batch = True
                should_sync_preferences_answers = True
            if "age_range" in prefs:
                if prefs["age_range"] is None:
                    user.age_range_min = None
                    user.age_range_max = None
                else:
                    user.age_range_min = prefs["age_range"]["min"]
                    user.age_range_max = prefs["age_range"]["max"]
                should_reset_feed_batch = True
                should_sync_preferences_answers = True
            if "distance_km" in prefs:
                user.distance_km = prefs["distance_km"]
                should_reset_feed_batch = True
            if "goal" in prefs:
                user.goal = self._normalize_goal(prefs["goal"])
                should_reset_feed_batch = True

        if "first_name" in data:
            value = data.pop("first_name")
            user.first_name = value.strip() or None if isinstance(value, str) else value

        if "last_name" in data:
            value = data.pop("last_name")
            user.last_name = value.strip() or None if isinstance(value, str) else value

        if "gender" in data:
            gender = data.pop("gender")
            user.gender = gender.value if hasattr(gender, "value") else gender

        if "looking_for_genders" in data:
            user.looking_for_genders = [
                value.value if hasattr(value, "value") else value
                for value in (data.pop("looking_for_genders") or [])
            ]
            should_reset_feed_batch = True
            should_sync_preferences_answers = True

        if "age_range" in data:
            age_range = data.pop("age_range")
            if age_range is None:
                user.age_range_min = None
                user.age_range_max = None
            else:
                user.age_range_min = age_range["min"]
                user.age_range_max = age_range["max"]
            should_reset_feed_batch = True
            should_sync_preferences_answers = True

        if "distance_km" in data:
            user.distance_km = data.pop("distance_km")
            should_reset_feed_batch = True

        if "goal" in data:
            user.goal = self._normalize_goal(data.pop("goal"))
            should_reset_feed_batch = True

        if "interests" in data:
            user.interests = list(data.pop("interests") or [])
            should_reset_feed_batch = True
            should_sync_ml_preferences = True
            should_sync_preferences_answers = True

        if import_transactions is not None:
            should_sync_ml_preferences = True
            should_reset_feed_batch = True
            should_sync_preferences_answers = True

        for field, value in data.items():
            setattr(user, field, value)

        user.is_onboarded = user.can_open_feed
        if should_sync_preferences_answers:
            await self._sync_preferences_quiz_answers(
                user=user,
                import_transactions=import_transactions,
            )
        if should_reset_feed_batch and self.matchmaking_repo is not None:
            await self.matchmaking_repo.reset_batch_for_date(
                user_id=user.id,
                batch_date=datetime.now().date(),
            )
            
        await self.uow.commit()

        refreshed_user = await self.user_repo.get_by_id(user.id)
        if refreshed_user is None:
            return user

        if should_sync_ml_preferences and self.ml_facade is not None:
            await self.ml_facade.sync_profile_preferences(
                user_id=refreshed_user.id,
                ml_user_id=refreshed_user.service_user_id,
                favorite_categories=list(refreshed_user.interests or []),
                import_transactions=(
                    bool(import_transactions)
                    if import_transactions is not None
                    else await self._get_import_transactions_value(refreshed_user.id)
                ),
            )
        return refreshed_user

    async def _sync_preferences_quiz_answers(
        self,
        *,
        user: User,
        import_transactions: bool | None,
    ) -> None:
        if self.matchmaking_repo is None:
            return

        match_preferences_answers: list[str] = [
            *[
                f"gender:{gender}"
                for gender in list(user.looking_for_genders or [])
                if gender
            ],
        ]
        if user.age_range_min is not None and user.age_range_max is not None:
            match_preferences_answers.extend(
                [
                    f"age_min:{user.age_range_min}",
                    f"age_max:{user.age_range_max}",
                ]
            )

        await self.matchmaking_repo.upsert_quiz_answer(
            user_id=user.id,
            step_key="match_preferences",
            answers=match_preferences_answers,
        )
        await self.matchmaking_repo.upsert_quiz_answer(
            user_id=user.id,
            step_key="interests",
            answers=list(user.interests or []),
        )

        if import_transactions is not None:
            await self.matchmaking_repo.upsert_quiz_answer(
                user_id=user.id,
                step_key="import_transactions",
                answers=[str(bool(import_transactions)).lower()],
            )

    async def create_avatar_presign(
        self,
        *,
        user: User,
        filename: str,
        content_type: str,
    ) -> AvatarPresignResponse:
        if content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
            raise UnsupportedAvatarContentTypeError(list(ALLOWED_AVATAR_CONTENT_TYPES))

        object_key = self.media_storage.build_avatar_key(user.id, filename, content_type)
        upload_url = self.media_storage.create_presigned_upload_url(
            bucket=self.settings.STORAGE_PUBLIC_BUCKET,
            key=object_key,
            content_type=content_type,
            expires_in=self.settings.STORAGE_PRESIGN_EXPIRES_SEC,
        )
        return AvatarPresignResponse(
            object_key=object_key,
            upload_url=upload_url,
            public_url=self.media_storage.build_public_url(
                bucket=self.settings.STORAGE_PUBLIC_BUCKET,
                key=object_key,
            ),
            expires_in=self.settings.STORAGE_PRESIGN_EXPIRES_SEC,
        )

    async def confirm_avatar_upload(self, *, user: User, file_key: str) -> AvatarResponse:
        expected_prefix = f"avatars/{user.id}/"
        if not file_key.startswith(expected_prefix):
            raise InvalidAvatarObjectKeyError()

        stat = await asyncio.to_thread(
            lambda: self.media_storage.get_object_stat(
                bucket=self.settings.STORAGE_PUBLIC_BUCKET,
                key=file_key,
            ),
        )
        if stat is None:
            raise AvatarObjectNotFoundError()

        if stat.content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
            raise AvatarUnsupportedContentTypeError()

        max_size_bytes = self.settings.MAX_PHOTO_SIZE * 1024 * 1024
        if stat.size_bytes > max_size_bytes:
            raise AvatarTooLargeError(self.settings.MAX_PHOTO_SIZE)

        previous_avatar_key = user.avatar_key
        user.avatar_key = file_key
        user.avatar_status = AvatarModerationStatus.APPROVED.value
        user.avatar_rejection_reason = None
        user.is_onboarded = user.can_open_feed
        await self.uow.commit()
        await self.uow.session.refresh(user)

        if previous_avatar_key and previous_avatar_key != file_key:
            await asyncio.to_thread(
                lambda: self.media_storage.delete_object(
                    bucket=self.settings.STORAGE_PUBLIC_BUCKET,
                    key=previous_avatar_key,
                ),
            )
        return self._build_avatar_response(user)

    async def remove_avatar(self, *, user: User) -> None:
        if not user.avatar_key:
            return

        avatar_key = user.avatar_key
        user.avatar_key = None
        user.avatar_status = AvatarModerationStatus.MISSING.value
        user.is_onboarded = False
        await self.uow.commit()
        await self.uow.session.refresh(user)

        await asyncio.to_thread(
            lambda: self.media_storage.delete_object(
                bucket=self.settings.STORAGE_PUBLIC_BUCKET,
                key=avatar_key,
            ),
        )

    async def get_avatar(self, *, user: User) -> AvatarResponse:
        return self._build_avatar_response(user)

    async def admin_list_users(
        self,
        *,
        banned: bool | None = None,
        search: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> tuple[list[User], str | None]:
        cursor_created_at = None
        cursor_id = None
        if cursor:
            try:
                ts_str, id_str = cursor.split("_", 1)
                cursor_created_at = datetime.fromisoformat(ts_str)
                cursor_id = UUID(id_str)
            except Exception:
                raise InvalidCursorError()

        users = await self.user_repo.admin_list_users(
            banned=banned,
            search=search,
            limit=limit,
            cursor_created_at=cursor_created_at,
            cursor_id=cursor_id,
        )

        next_cursor = None
        if len(users) == limit:
            last = users[-1]
            if last.created_at is None:
                next_cursor = None
            else:
                next_cursor = f"{last.created_at.isoformat()}_{last.id}"

        return users, next_cursor

    async def admin_set_ban(self, target: User, banned: bool) -> User:
        target.banned = banned
        target.bump_auth_version()
        await self.uow.commit()
        await self.uow.session.refresh(target)
        # await self._invalidate_permissions_cache(target.id, target.auth_version)
        return target

    async def list_languages(self, search: str, limit: int):
        return await self.lang_repo.search(search, limit)

    async def admin_assign_roles(
        self,
        target: User,
        role_slugs: list[str],
    ) -> User:
        unique_slugs = list(dict.fromkeys(role_slugs))
        roles = await self.role_repo.get_by_slugs(unique_slugs)
        found_slugs = {role.slug for role in roles}
        missing = [slug for slug in unique_slugs if slug not in found_slugs]
        if missing:
            raise UnknownRolesError(missing)

        await self.user_repo.assign_roles(target, roles)
        target.bump_auth_version()
        await self.uow.commit()
        await self.uow.session.refresh(target)

        # await self._invalidate_permissions_cache(target.id, target.auth_version)
        return target

    def _build_avatar_response(self, user: User) -> AvatarResponse:
        status = getattr(
            user,
            "avatar_moderation_status",
            getattr(user, "avatar_status", AvatarModerationStatus.MISSING.value),
        )
        return AvatarResponse(
            avatar_url=getattr(user, "avatar_url", None),
            status=status,
            uploaded_at=getattr(user, "updated_at", None) if user.avatar_key else None,
            moderation_reason=getattr(user, "avatar_rejection_reason", None),
        )

    def _build_search_preferences(self, user: User) -> SearchPreferences:
        return SearchPreferences(
            looking_for_genders=list(user.looking_for_genders or []),
            age_range=user.age_range,
            distance_km=user.distance_km,
            goal=user.goal,
        )

    async def _get_import_transactions_value(self, user_id: UUID | str) -> bool:
        if self.matchmaking_repo is None:
            return True
        saved_answer = await self.matchmaking_repo.get_quiz_answer(
            user_id=user_id,
            step_key="import_transactions",
        )
        if saved_answer is None or not saved_answer.answers:
            return True
        return saved_answer.answers[0].strip().lower() != "false"

    def _build_legacy_avatar_status(self, user: User) -> str | None:
        status = getattr(
            user,
            "avatar_moderation_status",
            getattr(user, "avatar_status", AvatarModerationStatus.MISSING.value),
        )
        if status == AvatarModerationStatus.PENDING.value:
            return "pending_moderation"
        if status == AvatarModerationStatus.APPROVED.value:
            return "approved"
        if status == AvatarModerationStatus.REJECTED.value:
            return "rejected"
        return None

    def _build_legacy_profile_status(self, user: User) -> str:
        if user.banned:
            return "blocked"
        if user.can_open_feed:
            return "active"
        return "restricted"

    def _build_legacy_goal(self, goal: str | None) -> str | None:
        if goal == "new_friends":
            return "friendship"
        if goal == "casual_dates":
            return "dating"
        return goal

    def _normalize_goal(self, goal: object) -> str | None:
        value = goal.value if hasattr(goal, "value") else goal
        if value == "friendship":
            return "new_friends"
        if value == "dating":
            return "casual_dates"
        return value

    # async def _invalidate_permissions_cache(
    #     self,
    #     user_id: UUID | str,
    #     previous_version: int | None,
    # ) -> None:
    #     if not self.cache_repo or previous_version is None:
    #         return
    #     cache_key = permissions_cache_key(user_id, previous_version)
    #     await self.cache_repo.delete(cache_key)
