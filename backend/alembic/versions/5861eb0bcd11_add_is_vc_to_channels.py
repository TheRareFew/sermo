"""add_is_vc_to_channels

Revision ID: 5861eb0bcd11
Revises: 1b13cd373828
Create Date: 2024-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5861eb0bcd11'
down_revision: Union[str, None] = '1b13cd373828'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_vc column to channels table
    op.add_column('channels', sa.Column('is_vc', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove is_vc column from channels table
    op.drop_column('channels', 'is_vc') 