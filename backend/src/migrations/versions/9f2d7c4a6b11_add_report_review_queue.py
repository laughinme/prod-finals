"""add report review queue

Revision ID: 9f2d7c4a6b11
Revises: 8c1d7a4b5e2f
Create Date: 2026-03-17 02:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "9f2d7c4a6b11"
down_revision: str | Sequence[str] | None = "8c1d7a4b5e2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reports",
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "reports",
        sa.Column("review_action", sa.String(length=32), nullable=False, server_default="none"),
    )
    op.add_column(
        "reports",
        sa.Column("reviewer_user_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.add_column(
        "reports",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "reports",
        sa.Column("review_note", sa.String(length=1000), nullable=True),
    )
    op.create_foreign_key(
        "fk_reports_reviewer_user_id",
        "reports",
        "users",
        ["reviewer_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_reports_reviewer_user_id", "reports", type_="foreignkey")
    op.drop_column("reports", "review_note")
    op.drop_column("reports", "reviewed_at")
    op.drop_column("reports", "reviewer_user_id")
    op.drop_column("reports", "review_action")
    op.drop_column("reports", "review_status")
