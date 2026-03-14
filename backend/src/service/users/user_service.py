import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

from core.config import get_settings
# from core.rbac import permissions_cache_key
from database.redis import CacheRepo
from database.relational_db import (
    CitiesInterface,
    DatingInterface,
    LanguagesInterface,
    RolesInterface,
    User,
    UserInterface,
    UoW,
)
from domain.dating import (
    AvatarModerationStatus,
    AvatarResponse,
    InsightCard,
    InsightStrength,
    SearchPreferences,
    UserInsightsResponse,
)
from domain.dating.quiz_catalog import derive_lifestyle_tags
from domain.users.schemas.avatar import AvatarPresignResponse
from domain.users.schemas.profile import UserPatch
from domain.users.schemas.profile import UserModel
from service.media import ALLOWED_AVATAR_CONTENT_TYPES, MediaStorageService
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
        dating_repo: DatingInterface | None = None,
        cache_repo: CacheRepo | None = None,
    ):
        self.uow = uow
        self.user_repo = user_repo
        self.city_repo = city_repo
        self.dating_repo = dating_repo
        self.lang_repo = lang_repo
        self.role_repo = role_repo
        self.media_storage = media_storage
        self.cache_repo = cache_repo
        self.settings = get_settings()
        
    async def get_user(self, user_id: UUID | str) -> User | None:
        return await self.user_repo.get_by_id(user_id)

    async def get_user_by_demo_key(self, demo_user_key: str) -> User | None:
        return await self.user_repo.get_by_demo_user_key(demo_user_key)

    async def serialize_user(self, user: User) -> UserModel:
        answer_map = await self._get_quiz_answer_map(user.id)
        lifestyle_tags = derive_lifestyle_tags(answer_map)
        return UserModel(
            id=user.id,
            email=user.email,
            display_name=user.resolved_display_name or "",
            birth_date=user.birth_date,
            age=user.age,
            city=user.city.name if user.city else None,
            gender=user.gender,
            bio=user.bio,
            quiz_status=user.quiz_status,
            profile_status=user.profile_status,
            recommendation_mode=user.recommendation_mode,
            search_preferences=self._build_search_preferences(user),
            avatar=self._build_avatar_response(user),
            lifestyle_tags=lifestyle_tags,
            profile_completion_percent=user.profile_completion_percent,
            can_open_feed=user.can_open_feed,
        )

    async def get_user_insights(self, user: User) -> UserInsightsResponse:
        answer_map = await self._get_quiz_answer_map(user.id)
        tags = derive_lifestyle_tags(answer_map)
        cards = [
            InsightCard(
                code=tag.code,
                title=tag.label,
                description="This signal helps improve recommendation quality.",
                strength=tag.strength,
            )
            for tag in tags
        ]

        if not cards and user.missing_required_fields:
            cards.append(
                InsightCard(
                    code="profile_completion",
                    title="Complete required profile fields",
                    description="Adding the basics unlocks more relevant matching.",
                    strength=InsightStrength.HIGH,
                )
            )
        if not cards:
            cards.append(
                InsightCard(
                    code="more_history",
                    title="Keep using the feed",
                    description="More actions help tune your recommendations over time.",
                    strength=InsightStrength.MEDIUM,
                )
            )

        return UserInsightsResponse(
            profile_completion_percent=user.profile_completion_percent,
            cards=cards,
            privacy_note="Insights are based on your profile and optional quiz answers.",
        )

    async def patch_user(self, payload: UserPatch, user: User):
        data = payload.model_dump(exclude_none=True)

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
            if prefs.get("looking_for_genders") is not None:
                user.looking_for_genders = [
                    value.value if hasattr(value, "value") else value
                    for value in prefs["looking_for_genders"]
                ]
            if prefs.get("age_range") is not None:
                user.age_range_min = prefs["age_range"]["min"]
                user.age_range_max = prefs["age_range"]["max"]
            if prefs.get("distance_km") is not None:
                user.distance_km = prefs["distance_km"]
            elif user.distance_km is None:
                user.distance_km = 30
            if prefs.get("goal") is not None:
                goal = prefs["goal"]
                user.goal = goal.value if hasattr(goal, "value") else goal

        if "display_name" in data:
            user.display_name = data.pop("display_name").strip() or None

        if "gender" in data:
            gender = data.pop("gender")
            user.gender = gender.value if hasattr(gender, "value") else gender

        for field, value in data.items():
            setattr(user, field, value)

        if user.distance_km is None and user.looking_for_genders:
            user.distance_km = 30

        user.is_onboarded = user.can_open_feed
            
        await self.uow.commit()
            
        await self.uow.session.refresh(user)

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
            file_key=object_key,
            upload_url=upload_url,
            expires_at=datetime.now(UTC) + timedelta(seconds=self.settings.STORAGE_PRESIGN_EXPIRES_SEC),
            max_size_mb=self.settings.MAX_PHOTO_SIZE,
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

    async def _get_quiz_answer_map(self, user_id: UUID) -> dict[str, list[str]]:
        if self.dating_repo is None:
            return {}
        rows = await self.dating_repo.list_quiz_answers(user_id=user_id)
        return {row.step_key: list(row.answers or []) for row in rows}

    # async def _invalidate_permissions_cache(
    #     self,
    #     user_id: UUID | str,
    #     previous_version: int | None,
    # ) -> None:
    #     if not self.cache_repo or previous_version is None:
    #         return
    #     cache_key = permissions_cache_key(user_id, previous_version)
    #     await self.cache_repo.delete(cache_key)
