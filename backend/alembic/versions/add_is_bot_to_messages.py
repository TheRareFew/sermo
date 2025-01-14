"""add is_bot field to messages

Revision ID: add_is_bot_to_messages
Revises: add_is_bot_to_users
Create Date: 2025-01-13 20:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_is_bot_to_messages'
down_revision: Union[str, None] = 'add_is_bot_to_users'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_bot column to messages table
    op.add_column('messages', sa.Column('is_bot', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove is_bot column from messages table
    op.drop_column('messages', 'is_bot') 