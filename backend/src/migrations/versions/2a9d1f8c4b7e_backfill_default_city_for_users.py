"""backfill default city for users

Revision ID: 2a9d1f8c4b7e
Revises: 1f3e5a7b9c2d
Create Date: 2026-03-16 20:10:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "2a9d1f8c4b7e"
down_revision: str | Sequence[str] | None = "1f3e5a7b9c2d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE users SET city_id = 'msk' WHERE city_id IS NULL")


def downgrade() -> None:
    op.execute("UPDATE users SET city_id = NULL WHERE city_id = 'msk'")
