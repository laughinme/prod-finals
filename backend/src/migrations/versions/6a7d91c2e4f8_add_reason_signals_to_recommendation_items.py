"""add reason signals to recommendation items

Revision ID: 6a7d91c2e4f8
Revises: f19c2b4a7d61
Create Date: 2026-03-16 20:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "6a7d91c2e4f8"
down_revision = "f19c2b4a7d61"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "recommendation_items",
        sa.Column("reason_signals", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.alter_column("recommendation_items", "reason_signals", server_default=None)


def downgrade() -> None:
    op.drop_column("recommendation_items", "reason_signals")
