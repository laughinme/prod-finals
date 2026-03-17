"""add like notifications

Revision ID: 8c1d7a4b5e2f
Revises: 4b8d2e1f6c30
Create Date: 2026-03-16 22:10:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "8c1d7a4b5e2f"
down_revision: Union[str, Sequence[str], None] = "4b8d2e1f6c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "message_notifications" not in table_names:
        op.create_table(
            "message_notifications",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("match_id", sa.Uuid(), nullable=False),
            sa.Column("conversation_id", sa.Uuid(), nullable=False),
            sa.Column("message_id", sa.Uuid(), nullable=False),
            sa.Column("sender_user_id", sa.Uuid(), nullable=False),
            sa.Column(
                "notification_type",
                sa.String(length=32),
                nullable=False,
                server_default="message_received",
            ),
            sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["conversation_id"], ["conversations.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["message_id"], ["messages.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["sender_user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "message_id", name="uq_message_notifications_user_message"
            ),
        )
        op.create_index(
            "ix_message_notifications_user_seen_created",
            "message_notifications",
            ["user_id", "seen_at", "created_at"],
            unique=False,
        )
        op.create_index(
            "ix_message_notifications_user_conversation_read",
            "message_notifications",
            ["user_id", "conversation_id", "read_at", "created_at"],
            unique=False,
        )

    if "like_notifications" not in table_names:
        op.create_table(
            "like_notifications",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("liker_user_id", sa.Uuid(), nullable=False),
            sa.Column("pair_state_id", sa.Uuid(), nullable=False),
            sa.Column(
                "notification_type",
                sa.String(length=32),
                nullable=False,
                server_default="like_received",
            ),
            sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["liker_user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["pair_state_id"], ["pair_states.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "pair_state_id", name="uq_like_notifications_user_pair_state"
            ),
        )
        op.create_index(
            "ix_like_notifications_user_seen_created",
            "like_notifications",
            ["user_id", "seen_at", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())
    if "like_notifications" in table_names:
        op.drop_index(
            "ix_like_notifications_user_seen_created", table_name="like_notifications"
        )
        op.drop_table("like_notifications")
    if "message_notifications" in table_names:
        op.drop_index(
            "ix_message_notifications_user_conversation_read",
            table_name="message_notifications",
        )
        op.drop_index(
            "ix_message_notifications_user_seen_created",
            table_name="message_notifications",
        )
        op.drop_table("message_notifications")
