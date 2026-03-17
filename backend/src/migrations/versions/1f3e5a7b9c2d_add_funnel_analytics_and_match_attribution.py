"""add funnel analytics and match attribution

Revision ID: 1f3e5a7b9c2d
Revises: 6a7d91c2e4f8
Create Date: 2026-03-16 15:45:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "1f3e5a7b9c2d"
down_revision: str | Sequence[str] | None = "6a7d91c2e4f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("source_decision_mode", sa.String(length=32), nullable=True),
    )

    op.create_table(
        "analytics_daily_funnel",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("user_source", sa.String(length=32), nullable=False),
        sa.Column("decision_mode", sa.String(length=32), nullable=False),
        sa.Column("feed_served", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "feed_explanation_opened", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("feed_like", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("feed_pass", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("feed_hide", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("match_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "chat_first_message_sent", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "chat_first_reply_received",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("match_closed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("user_blocked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("user_reported", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "day",
            "user_source",
            "decision_mode",
            name="uq_analytics_daily_funnel_segment",
        ),
    )
    op.create_index(
        "ix_analytics_daily_funnel_day",
        "analytics_daily_funnel",
        ["day"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_analytics_daily_funnel_day", table_name="analytics_daily_funnel")
    op.drop_table("analytics_daily_funnel")
    op.drop_column("matches", "source_decision_mode")
