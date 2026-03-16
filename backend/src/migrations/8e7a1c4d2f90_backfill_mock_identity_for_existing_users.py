"""backfill mock identity for existing users

Revision ID: 8e7a1c4d2f90
Revises: 5f1c2d8a9b71
Create Date: 2026-03-15 15:25:00.000000
"""

from datetime import date
from hashlib import sha256
from typing import Sequence, Union
from uuid import UUID

from alembic import op
import sqlalchemy as sa


revision: str = "8e7a1c4d2f90"
down_revision: Union[str, Sequence[str], None] = "5f1c2d8a9b71"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


users_table = sa.table(
    "users",
    sa.column("id", sa.Uuid(as_uuid=True)),
    sa.column("email", sa.String()),
    sa.column("service_user_id", sa.String()),
    sa.column("birth_date", sa.Date()),
    sa.column("gender", sa.String()),
)


def _seeded_int(seed: str) -> int:
    return int(sha256(seed.encode("utf-8")).hexdigest()[:16], 16)


def _build_service_user_id(seed: str) -> str:
    return sha256(f"legacy:{seed}".encode("utf-8")).hexdigest()


def _build_gender(seed: str) -> str:
    value = _seeded_int(seed) % 100
    if value < 46:
        return "male"
    if value < 92:
        return "female"
    return "other"


def _build_birth_date(seed: str) -> date:
    value = _seeded_int(seed)
    age = 19 + (value % 18)
    month = 1 + ((value // 101) % 12)
    day = 1 + ((value // 1213) % 28)
    year = date.today().year - age
    return date(year, month, day)


def _identity_seed(user_id: UUID, email: str | None) -> str:
    normalized_email = (email or "").strip().lower()
    if normalized_email:
        return normalized_email
    return str(user_id)


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.select(
            users_table.c.id,
            users_table.c.email,
            users_table.c.service_user_id,
            users_table.c.birth_date,
            users_table.c.gender,
        ).where(
            sa.or_(
                users_table.c.service_user_id.is_(None),
                users_table.c.birth_date.is_(None),
                users_table.c.gender.is_(None),
            )
        )
    ).mappings()

    for row in rows:
        seed = _identity_seed(row["id"], row["email"])
        values: dict[str, object] = {}

        if not row["service_user_id"]:
            values["service_user_id"] = _build_service_user_id(seed)
        if row["birth_date"] is None:
            values["birth_date"] = _build_birth_date(seed)
        if not row["gender"]:
            values["gender"] = _build_gender(seed)

        if values:
            bind.execute(
                sa.update(users_table)
                .where(users_table.c.id == row["id"])
                .values(**values)
            )


def downgrade() -> None:
    # Data backfill is intentionally irreversible.
    pass
