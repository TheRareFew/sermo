"""add is_bot field to users

Revision ID: add_is_bot_to_users
Revises: 300e0cd78c6a
Create Date: 2025-01-13 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_is_bot_to_users'
down_revision: Union[str, None] = '300e0cd78c6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_bot column to users table
    op.add_column('users', sa.Column('is_bot', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove is_bot column from users table
    op.drop_column('users', 'is_bot') 