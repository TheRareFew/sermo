"""add description to users

Revision ID: 20af80d894bd
Revises: fix_refresh_tokens_column
Create Date: 2024-01-17 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20af80d894bd'
down_revision: Union[str, None] = 'fix_refresh_tokens_column'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add description column to users table
    op.add_column('users', sa.Column('description', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove description column from users table
    op.drop_column('users', 'description') 