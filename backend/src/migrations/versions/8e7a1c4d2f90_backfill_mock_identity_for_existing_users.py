"""backfill mock identity defaults for existing users

Revision ID: 8e7a1c4d2f90
Revises: 5f1c2d8a9b71
Create Date: 2026-03-15 18:55:00.000000
"""

from __future__ import annotations

from datetime import date
from hashlib import sha256
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8e7a1c4d2f90"
down_revision: Union[str, Sequence[str], None] = "5f1c2d8a9b71"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FIRST_NAMES = {
    "male": ("Алексей", "Илья", "Иван", "Михаил", "Никита", "Роман"),
    "female": ("Анна", "Мария", "Екатерина", "Ольга", "Алина", "София"),
}
_LAST_NAMES = ("Иванов", "Петров", "Смирнов", "Кузнецов", "Соколов", "Попов")


def _profile_seed(email: str, user_id: str) -> bytes:
    return sha256(f"{email.lower()}:{user_id}".encode("utf-8")).digest()


def _service_user_id(email: str, user_id: str) -> str:
    return f"legacy-{sha256(f'{email.lower()}:{user_id}'.encode('utf-8')).hexdigest()[:32]}"


def _gender(seed: bytes) -> str:
    return "female" if seed[0] % 2 else "male"


def _birth_date(seed: bytes) -> date:
    age = 21 + (seed[1] % 18)
    year = max(date.today().year - age, 1980)
    month = 1 + (seed[2] % 12)
    day = 1 + (seed[3] % 28)
    return date(year, month, day)


def _display_name(seed: bytes, username: str | None) -> str:
    if username:
        normalized = username.replace("_", " ").replace("-", " ").strip()
        if normalized:
            return normalized.title()

    gender = _gender(seed)
    first = _FIRST_NAMES[gender][seed[4] % len(_FIRST_NAMES[gender])]
    last = _LAST_NAMES[seed[5] % len(_LAST_NAMES)]
    return f"{first} {last}"


def _username(seed: bytes, email: str) -> str:
    local = email.split("@", 1)[0].strip().lower()
    if local:
        return local[:64]
    return f"user_{seed.hex()[:10]}"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_dataset_user",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            select id, email, username, display_name, gender, birth_date, service_user_id
            from users
            """
        )
    ).mappings()

    for row in rows:
        seed = _profile_seed(row["email"], str(row["id"]))
        payload: dict[str, object] = {}

        if row["service_user_id"] is None:
            payload["service_user_id"] = _service_user_id(row["email"], str(row["id"]))
        if row["gender"] is None:
            payload["gender"] = _gender(seed)
        if row["birth_date"] is None:
            payload["birth_date"] = _birth_date(seed)
        if row["display_name"] is None:
            payload["display_name"] = _display_name(seed, row["username"])
        if row["username"] is None:
            payload["username"] = _username(seed, row["email"])

        if payload:
            payload["user_id"] = row["id"]
            bind.execute(
                sa.text(
                    """
                    update users
                    set service_user_id = coalesce(:service_user_id, service_user_id),
                        gender = coalesce(:gender, gender),
                        birth_date = coalesce(:birth_date, birth_date),
                        display_name = coalesce(:display_name, display_name),
                        username = coalesce(:username, username)
                    where id = :user_id
                    """
                ),
                {
                    "service_user_id": payload.get("service_user_id"),
                    "gender": payload.get("gender"),
                    "birth_date": payload.get("birth_date"),
                    "display_name": payload.get("display_name"),
                    "username": payload.get("username"),
                    "user_id": payload["user_id"],
                },
            )


def downgrade() -> None:
    op.drop_column("users", "is_dataset_user")
