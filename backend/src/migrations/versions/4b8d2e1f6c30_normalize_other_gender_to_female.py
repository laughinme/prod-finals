"""normalize other gender values to female

Revision ID: 4b8d2e1f6c30
Revises: 2a9d1f8c4b7e
Create Date: 2026-03-16 20:05:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4b8d2e1f6c30"
down_revision: Union[str, Sequence[str], None] = "2a9d1f8c4b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE users SET gender = 'female' WHERE gender = 'other'")


def downgrade() -> None:
    op.execute(
        "UPDATE users SET gender = 'other' WHERE gender = 'female' AND email = 'admin.demo@example.com'"
    )
