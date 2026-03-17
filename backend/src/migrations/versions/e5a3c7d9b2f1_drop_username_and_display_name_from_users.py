"""drop username and display_name from users

Revision ID: e5a3c7d9b2f1
Revises: c4d2e9f1a6b3
Create Date: 2026-03-15 22:45:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5a3c7d9b2f1"
down_revision: Union[str, Sequence[str], None] = "c4d2e9f1a6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("users_username_trgm", table_name="users", postgresql_using="gin")
    op.drop_column("users", "display_name")
    op.drop_column("users", "username")


def downgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(), nullable=True))
    op.add_column(
        "users", sa.Column("display_name", sa.String(length=80), nullable=True)
    )
    op.create_index(
        "users_username_trgm",
        "users",
        ["username"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"username": "gin_trgm_ops"},
    )
