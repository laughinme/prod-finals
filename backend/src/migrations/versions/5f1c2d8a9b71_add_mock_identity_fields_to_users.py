"""add mock identity fields to users

Revision ID: 5f1c2d8a9b71
Revises: 7c9a4e2d1b6f
Create Date: 2026-03-15 14:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5f1c2d8a9b71"
down_revision: Union[str, Sequence[str], None] = "7c9a4e2d1b6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("service_user_id", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "interests", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
        ),
    )
    op.create_unique_constraint(
        "uq_users_service_user_id", "users", ["service_user_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_service_user_id", "users", type_="unique")
    op.drop_column("users", "interests")
    op.drop_column("users", "service_user_id")
