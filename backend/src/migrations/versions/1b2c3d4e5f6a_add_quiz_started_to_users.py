"""add quiz_started to users

Revision ID: 1b2c3d4e5f6a
Revises: 9b1f0f6b9d2e
Create Date: 2026-03-14 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "1b2c3d4e5f6a"
down_revision = "9b1f0f6b9d2e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("quiz_started", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.execute(
        """
        UPDATE users
        SET quiz_started = true
        WHERE looking_for_genders IS NOT NULL
          AND json_array_length(looking_for_genders) > 0
        """
    )
    op.alter_column("users", "quiz_started", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "quiz_started")
