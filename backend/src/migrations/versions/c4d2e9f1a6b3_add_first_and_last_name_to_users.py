"""add first and last name to users

Revision ID: c4d2e9f1a6b3
Revises: b1f6b7c8d9e0
Create Date: 2026-03-15 22:25:00.000000
"""

from __future__ import annotations

from hashlib import sha256
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d2e9f1a6b3"
down_revision: Union[str, Sequence[str], None] = "b1f6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FIRST_NAMES = {
    "male": (
        "Алексей",
        "Илья",
        "Иван",
        "Михаил",
        "Никита",
        "Роман",
        "Максим",
        "Кирилл",
    ),
    "female": (
        "Анна",
        "Мария",
        "Екатерина",
        "Ольга",
        "Алина",
        "София",
        "Дарья",
        "Полина",
    ),
}
_LAST_NAMES = (
    "Иванов",
    "Петров",
    "Смирнов",
    "Кузнецов",
    "Соколов",
    "Попов",
    "Лебедев",
    "Козлов",
)


def _seed(email: str, user_id: str, service_user_id: str | None) -> bytes:
    identity = service_user_id or email.lower() or user_id
    return sha256(f"{identity}:{user_id}".encode("utf-8")).digest()


def _gender(seed: bytes) -> str:
    return "female" if seed[0] % 2 else "male"


def _generated_names(seed: bytes) -> tuple[str, str]:
    gender = _gender(seed)
    first_name = _FIRST_NAMES[gender][seed[1] % len(_FIRST_NAMES[gender])]
    last_name = _LAST_NAMES[seed[2] % len(_LAST_NAMES)]
    return first_name, last_name


def _split_display_name(display_name: str | None) -> tuple[str | None, str | None]:
    if not display_name:
        return None, None
    parts = [part for part in display_name.strip().split() if part]
    if not parts:
        return None, None
    first_name = parts[0]
    last_name = " ".join(parts[1:]) or None
    return first_name, last_name


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=80), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            select id, email, service_user_id, display_name, first_name, last_name
            from users
            """
        )
    ).mappings()

    for row in rows:
        if row["first_name"] and row["last_name"]:
            continue

        parsed_first, parsed_last = _split_display_name(row["display_name"])
        seed = _seed(row["email"], str(row["id"]), row["service_user_id"])
        generated_first, generated_last = _generated_names(seed)

        bind.execute(
            sa.text(
                """
                update users
                set first_name = coalesce(first_name, :first_name),
                    last_name = coalesce(last_name, :last_name)
                where id = :user_id
                """
            ),
            {
                "first_name": parsed_first or generated_first,
                "last_name": parsed_last or generated_last,
                "user_id": row["id"],
            },
        )


def downgrade() -> None:
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
