"""add preference categories and category breakdown

Revision ID: b1f6b7c8d9e0
Revises: 8e7a1c4d2f90
Create Date: 2026-03-15 20:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1f6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "8e7a1c4d2f90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "preference_categories",
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("key"),
        sa.UniqueConstraint("label"),
    )
    op.add_column(
        "recommendation_items",
        sa.Column("category_breakdown", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    op.drop_column("recommendation_items", "category_breakdown")
    op.drop_table("preference_categories")
