"""final contract backend rework

Revision ID: 9b1f0f6b9d2e
Revises: cdd6f1740d6a
Create Date: 2026-03-14 12:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b1f0f6b9d2e"
down_revision: Union[str, Sequence[str], None] = "cdd6f1740d6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "display_name",
        existing_type=sa.String(length=64),
        type_=sa.String(length=80),
    )
    op.add_column(
        "users",
        sa.Column(
            "quiz_status",
            sa.String(length=32),
            nullable=False,
            server_default="not_started",
        ),
    )
    op.add_column(
        "users", sa.Column("quiz_current_step_key", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "has_behavioral_profile",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users", sa.Column("demo_user_key", sa.String(length=64), nullable=True)
    )
    op.create_unique_constraint("uq_users_demo_user_key", "users", ["demo_user_key"])

    op.execute("UPDATE users SET quiz_status = 'not_started' WHERE quiz_status IS NULL")
    op.execute(
        "UPDATE users SET has_behavioral_profile = false WHERE has_behavioral_profile IS NULL"
    )
    op.execute("UPDATE users SET goal = 'casual_dates' WHERE goal = 'dating'")
    op.execute("UPDATE users SET goal = 'new_friends' WHERE goal = 'friendship'")
    op.execute("UPDATE users SET gender = 'non_binary' WHERE gender = 'other'")
    op.execute(
        "UPDATE users SET avatar_status = 'pending' WHERE avatar_status = 'pending_moderation'"
    )

    op.create_table(
        "onboarding_quiz_answers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("step_key", sa.String(length=64), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "step_key", name="uq_onboarding_quiz_answers_user_step"
        ),
    )
    op.create_index(
        "ix_onboarding_quiz_answers_user_id",
        "onboarding_quiz_answers",
        ["user_id"],
        unique=False,
    )

    op.drop_constraint(
        "uq_interaction_events_actor_client", "interaction_events", type_="unique"
    )
    op.create_unique_constraint(
        "uq_interaction_events_actor_serve_item",
        "interaction_events",
        ["actor_user_id", "serve_item_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_interaction_events_actor_serve_item", "interaction_events", type_="unique"
    )
    op.create_unique_constraint(
        "uq_interaction_events_actor_client",
        "interaction_events",
        ["actor_user_id", "client_event_id"],
    )

    op.drop_index(
        "ix_onboarding_quiz_answers_user_id", table_name="onboarding_quiz_answers"
    )
    op.drop_table("onboarding_quiz_answers")

    op.drop_constraint("uq_users_demo_user_key", "users", type_="unique")
    op.drop_column("users", "demo_user_key")
    op.drop_column("users", "has_behavioral_profile")
    op.drop_column("users", "quiz_current_step_key")
    op.drop_column("users", "quiz_status")
    op.alter_column(
        "users",
        "display_name",
        existing_type=sa.String(length=80),
        type_=sa.String(length=64),
    )

    op.execute("UPDATE users SET goal = 'dating' WHERE goal = 'casual_dates'")
    op.execute("UPDATE users SET goal = 'friendship' WHERE goal = 'new_friends'")
    op.execute("UPDATE users SET gender = 'other' WHERE gender = 'non_binary'")
    op.execute(
        "UPDATE users SET avatar_status = 'pending_moderation' WHERE avatar_status = 'pending'"
    )
