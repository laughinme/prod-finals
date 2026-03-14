import asyncio
from datetime import date

from core.config import Settings
from core.crypto import hash_password
from database.relational_db import CitiesInterface, RolesInterface, UoW, User, UserInterface
from domain.auth.enums import DEFAULT_ROLE
from service.media import MediaStorageService


DEMO_PASSWORD = "DemoPass123!"

DEMO_USERS = [
    {
        "demo_user_key": "anna",
        "email": "anna.demo@example.com",
        "username": "anna",
        "display_name": "Anna",
        "birth_date": "1998-05-12",
        "bio": "Coffee walks, theater, and short weekend trips.",
        "city_id": "msk",
        "gender": "female",
        "looking_for_genders": ["male"],
        "age_range_min": 25,
        "age_range_max": 34,
        "goal": "serious_relationship",
    },
    {
        "demo_user_key": "maria",
        "email": "maria.demo@example.com",
        "username": "maria",
        "display_name": "Maria",
        "birth_date": "1997-09-04",
        "bio": "Exhibitions, runs, and new restaurants.",
        "city_id": "msk",
        "gender": "female",
        "looking_for_genders": ["male"],
        "age_range_min": 26,
        "age_range_max": 36,
        "goal": "casual_dates",
    },
    {
        "demo_user_key": "dima",
        "email": "dima.demo@example.com",
        "username": "dima",
        "display_name": "Dima",
        "birth_date": "1995-01-16",
        "bio": "Product work, sport, and long breakfasts.",
        "city_id": "msk",
        "gender": "male",
        "looking_for_genders": ["female"],
        "age_range_min": 24,
        "age_range_max": 33,
        "goal": "serious_relationship",
    },
    {
        "demo_user_key": "kirill",
        "email": "kirill.demo@example.com",
        "username": "kirill",
        "display_name": "Kirill",
        "birth_date": "1996-03-28",
        "bio": "Concerts, squash, and rare but excellent trips.",
        "city_id": "msk",
        "gender": "male",
        "looking_for_genders": ["female"],
        "age_range_min": 23,
        "age_range_max": 32,
        "goal": "casual_dates",
    },
    {
        "demo_user_key": "olga",
        "email": "olga.demo@example.com",
        "username": "olga",
        "display_name": "Olga",
        "birth_date": "1994-08-21",
        "bio": "Architecture, yoga, and cultural routes.",
        "city_id": "spb",
        "gender": "female",
        "looking_for_genders": ["male"],
        "age_range_min": 28,
        "age_range_max": 38,
        "goal": "new_friends",
    },
    {
        "demo_user_key": "ivan",
        "email": "ivan.demo@example.com",
        "username": "ivan",
        "display_name": "Ivan",
        "birth_date": "1993-11-09",
        "bio": "Jazz, board games, and late walks.",
        "city_id": "spb",
        "gender": "male",
        "looking_for_genders": ["female"],
        "age_range_min": 25,
        "age_range_max": 37,
        "goal": "new_friends",
    },
    {
        "demo_user_key": "alisa",
        "email": "alisa.demo@example.com",
        "username": "alisa",
        "display_name": "Alisa",
        "birth_date": "2000-02-14",
        "bio": "Work, dance classes, and spontaneous flights.",
        "city_id": "kzn",
        "gender": "female",
        "looking_for_genders": ["male", "other"],
        "age_range_min": 22,
        "age_range_max": 31,
        "goal": "casual_dates",
    },
    {
        "demo_user_key": "roman",
        "email": "roman.demo@example.com",
        "username": "roman",
        "display_name": "Roman",
        "birth_date": "1999-06-18",
        "bio": "Mountains, bikes, and quiet evenings at home.",
        "city_id": "ekb",
        "gender": "male",
        "looking_for_genders": ["female"],
        "age_range_min": 21,
        "age_range_max": 30,
        "goal": "casual_dates",
    },
    {
        "demo_user_key": "admin_demo",
        "email": "admin.demo@example.com",
        "username": "admin_demo",
        "display_name": "Admin Demo",
        "birth_date": "1992-04-02",
        "bio": "Admin profile for demo and audit checks.",
        "city_id": "msk",
        "gender": "other",
        "looking_for_genders": ["female", "male", "other"],
        "age_range_min": 21,
        "age_range_max": 45,
        "goal": "new_friends",
        "roles": ["member", "admin"],
    },
]

SEED_AVATAR_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc``\x00\x00\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


async def ensure_dev_seed(
    *,
    uow: UoW,
    storage: MediaStorageService,
    settings: Settings,
) -> None:
    if settings.APP_STAGE == "prod" or not settings.DEV_SEED_ENABLED:
        return

    user_repo = UserInterface(uow.session)
    city_repo = CitiesInterface(uow.session)
    role_repo = RolesInterface(uow.session)
    member_role = await role_repo.get_by_slug(DEFAULT_ROLE.value)
    admin_role = await role_repo.get_by_slug("admin")
    if member_role is None:
        return

    password_hash = await hash_password(DEMO_PASSWORD)

    for payload in DEMO_USERS:
        city = await city_repo.get_by_id(payload["city_id"])
        if city is None:
            continue

        user = await user_repo.get_by_email(payload["email"])
        if user is None:
            user = User(email=payload["email"], password_hash=password_hash, username=payload["username"])
            await user_repo.add(user)
            await uow.session.flush()

        user.username = payload["username"]
        user.display_name = payload["display_name"]
        user.birth_date = date.fromisoformat(payload["birth_date"])
        user.bio = payload["bio"]
        user.city_id = city.id
        user.gender = payload["gender"]
        user.looking_for_genders = payload["looking_for_genders"]
        user.age_range_min = payload["age_range_min"]
        user.age_range_max = payload["age_range_max"]
        user.distance_km = 30
        user.goal = payload["goal"]
        user.demo_user_key = payload["demo_user_key"]
        user.is_onboarded = True
        user.avatar_status = "approved"
        user.avatar_rejection_reason = None

        if not user.avatar_key:
            user.avatar_key = f"avatars/{user.id}/seed.png"

        await asyncio.to_thread(
            storage.put_object_bytes,
            bucket=settings.STORAGE_PUBLIC_BUCKET,
            key=user.avatar_key,
            payload=SEED_AVATAR_BYTES,
            content_type="image/png",
        )

        assigned_roles = [member_role]
        if "roles" in payload and admin_role is not None and "admin" in payload["roles"]:
            assigned_roles = [member_role, admin_role]
        await user_repo.assign_roles(user, assigned_roles)

    await uow.commit()
