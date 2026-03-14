"""add dating backend mvp

Revision ID: cdd6f1740d6a
Revises: a629654c84b7
Create Date: 2026-03-14 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "cdd6f1740d6a"
down_revision: Union[str, Sequence[str], None] = "a629654c84b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cities",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "languages",
        sa.Column("code", sa.String(length=2), nullable=False),
        sa.Column("name_ru", sa.String(), nullable=False),
        sa.Column("name_en", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("code"),
    )
    op.create_index(
        "languages_name_ru_trgm",
        "languages",
        ["name_ru"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"name_ru": "gin_trgm_ops"},
    )
    op.create_index(
        "languages_name_en_trgm",
        "languages",
        ["name_en"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"name_en": "gin_trgm_ops"},
    )

    op.bulk_insert(
        sa.table(
            "cities",
            sa.column("id", sa.String()),
            sa.column("name", sa.String()),
        ),
        [
            {"id": "msk", "name": "Moscow"},
            {"id": "spb", "name": "Saint Petersburg"},
            {"id": "kzn", "name": "Kazan"},
            {"id": "ekb", "name": "Yekaterinburg"},
            {"id": "nsk", "name": "Novosibirsk"},
        ],
    )
    op.bulk_insert(
        sa.table(
            "languages",
            sa.column("code", sa.String()),
            sa.column("name_ru", sa.String()),
            sa.column("name_en", sa.String()),
        ),
        [
            {"code": "ru", "name_ru": "Русский", "name_en": "Russian"},
            {"code": "en", "name_ru": "Английский", "name_en": "English"},
        ],
    )

    op.add_column("users", sa.Column("display_name", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("avatar_status", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("avatar_rejection_reason", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("city_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(length=16), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "looking_for_genders",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column("users", sa.Column("age_range_min", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("age_range_max", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("distance_km", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("goal", sa.String(length=32), nullable=True))
    op.create_foreign_key("fk_users_city_id_cities", "users", "cities", ["city_id"], ["id"], ondelete="SET NULL")

    op.create_table(
        "recommendation_batches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("batch_date", sa.Date(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decision_mode", sa.String(length=32), nullable=False),
        sa.Column("daily_limit", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "batch_date", name="uq_recommendation_batches_user_date"),
    )
    op.create_table(
        "recommendation_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("compatibility_mode", sa.String(length=32), nullable=False),
        sa.Column("preview", sa.String(length=160), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("details_available", sa.Boolean(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reaction_action", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["recommendation_batches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("batch_id", "rank", name="uq_recommendation_items_batch_rank"),
        sa.UniqueConstraint("batch_id", "target_user_id", name="uq_recommendation_items_batch_target"),
    )
    op.create_index("ix_recommendation_items_batch_id", "recommendation_items", ["batch_id"], unique=False)
    op.create_index("ix_recommendation_items_target_user_id", "recommendation_items", ["target_user_id"], unique=False)

    op.create_table(
        "interaction_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("serve_item_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("source_context", sa.String(length=32), nullable=False),
        sa.Column("client_event_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["serve_item_id"], ["recommendation_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("actor_user_id", "client_event_id", name="uq_interaction_events_actor_client"),
    )
    op.create_index("ix_interaction_events_actor_target", "interaction_events", ["actor_user_id", "target_user_id"], unique=False)

    op.create_table(
        "pair_states",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_low_id", sa.Uuid(), nullable=False),
        sa.Column("user_high_id", sa.Uuid(), nullable=False),
        sa.Column("low_action", sa.String(length=16), nullable=True),
        sa.Column("high_action", sa.String(length=16), nullable=True),
        sa.Column("low_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("high_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocked_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("hidden_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("match_id", sa.Uuid(), nullable=True),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_high_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_low_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_pair_states_pair"),
    )
    op.create_index("ix_pair_states_status", "pair_states", ["status"], unique=False)

    op.create_table(
        "matches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_low_id", sa.Uuid(), nullable=False),
        sa.Column("user_high_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("close_reason", sa.String(length=64), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_high_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_low_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_matches_pair"),
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("match_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("sender_user_id", sa.Uuid(), nullable=False),
        sa.Column("client_message_id", sa.Uuid(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id", "client_message_id", name="uq_messages_conversation_client"),
    )
    op.create_index("ix_messages_conversation_created_at", "messages", ["conversation_id", "created_at"], unique=False)

    op.create_table(
        "blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("source_context", sa.String(length=32), nullable=False),
        sa.Column("reason_code", sa.String(length=32), nullable=False),
        sa.Column("client_event_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("actor_user_id", "target_user_id", name="uq_blocks_actor_target"),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("source_context", sa.String(length=32), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("related_message_id", sa.String(length=64), nullable=True),
        sa.Column("also_block", sa.Boolean(), nullable=False),
        sa.Column("client_event_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("actor_user_id", "client_event_id", name="uq_reports_actor_client"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_actor", "audit_log", ["actor_user_id"], unique=False)
    op.create_index("ix_audit_log_entity", "audit_log", ["entity_type", "entity_id"], unique=False)

    op.create_table(
        "outbox_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("topic", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outbox_events_status_available_at", "outbox_events", ["status", "available_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_outbox_events_status_available_at", table_name="outbox_events")
    op.drop_table("outbox_events")
    op.drop_index("ix_audit_log_entity", table_name="audit_log")
    op.drop_index("ix_audit_log_actor", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("reports")
    op.drop_table("blocks")
    op.drop_index("ix_messages_conversation_created_at", table_name="messages")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("matches")
    op.drop_index("ix_pair_states_status", table_name="pair_states")
    op.drop_table("pair_states")
    op.drop_index("ix_interaction_events_actor_target", table_name="interaction_events")
    op.drop_table("interaction_events")
    op.drop_index("ix_recommendation_items_target_user_id", table_name="recommendation_items")
    op.drop_index("ix_recommendation_items_batch_id", table_name="recommendation_items")
    op.drop_table("recommendation_items")
    op.drop_table("recommendation_batches")

    op.drop_constraint("fk_users_city_id_cities", "users", type_="foreignkey")
    op.drop_column("users", "goal")
    op.drop_column("users", "distance_km")
    op.drop_column("users", "age_range_max")
    op.drop_column("users", "age_range_min")
    op.drop_column("users", "looking_for_genders")
    op.drop_column("users", "gender")
    op.drop_column("users", "city_id")
    op.drop_column("users", "bio")
    op.drop_column("users", "birth_date")
    op.drop_column("users", "avatar_rejection_reason")
    op.drop_column("users", "avatar_status")
    op.drop_column("users", "display_name")

    op.drop_index("languages_name_en_trgm", table_name="languages")
    op.drop_index("languages_name_ru_trgm", table_name="languages")
    op.drop_table("languages")
    op.drop_table("cities")
