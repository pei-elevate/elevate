"""add elevator dge_number

Revision ID: a3f1c2d4e5b6
Revises: cc541ea6a6e8
Create Date: 2026-11-21 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f1c2d4e5b6"
down_revision: str | Sequence[str] | None = "cc541ea6a6e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("elevators", sa.Column("dge_number", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("elevators", "dge_number")
