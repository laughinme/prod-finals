"""add onboarding skip flag to users

Revision ID: f19c2b4a7d61
Revises: e5a3c7d9b2f1
Create Date: 2026-03-15 23:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f19c2b4a7d61"
down_revision: Union[str, Sequence[str], None] = "e5a3c7d9b2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_skipped",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.alter_column("users", "onboarding_skipped", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "onboarding_skipped")
