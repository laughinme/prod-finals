"""add match notifications

Revision ID: 2f4b6d8c9e1a
Revises: 1b2c3d4e5f6a
Create Date: 2026-03-15 15:30:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f4b6d8c9e1a"
down_revision: Union[str, Sequence[str], None] = "1b2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "match_notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("match_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("peer_user_id", sa.Uuid(), nullable=False),
        sa.Column("notification_type", sa.String(length=32), nullable=False, server_default="match_created"),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["peer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "match_id", name="uq_match_notifications_user_match"),
    )
    op.create_index(
        "ix_match_notifications_user_seen_created",
        "match_notifications",
        ["user_id", "seen_at", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_match_notifications_user_seen_created", table_name="match_notifications")
    op.drop_table("match_notifications")
