"""add_is_public_to_channels

Revision ID: 4a5ab2d8b88a
Revises: b3a0689ab2dd
Create Date: 2025-01-10 09:03:26.965768

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a5ab2d8b88a'
down_revision: Union[str, None] = 'b3a0689ab2dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_public column with default value True
    op.add_column('channels', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    # Remove is_public column
    op.drop_column('channels', 'is_public') 