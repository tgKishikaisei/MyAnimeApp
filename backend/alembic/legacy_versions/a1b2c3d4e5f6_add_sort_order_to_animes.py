"""add_sort_order_to_animes

Revision ID: a1b2c3d4e5f6
Revises: 08c8075d539f
Create Date: 2026-03-15 15:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '5390d63d125d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sort_order column to animes table for drag & drop sorting."""
    op.add_column('animes', sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'))
    op.create_index(op.f('ix_animes_sort_order'), 'animes', ['sort_order'], unique=False)
    # Set default sort_order based on existing ID order (higher ID = newer = lower sort_order)
    op.execute("UPDATE animes SET sort_order = 0 WHERE sort_order IS NULL")


def downgrade() -> None:
    """Remove sort_order column from animes table."""
    op.drop_index(op.f('ix_animes_sort_order'), table_name='animes')
    op.drop_column('animes', 'sort_order')
