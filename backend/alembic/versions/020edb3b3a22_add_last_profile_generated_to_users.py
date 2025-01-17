"""add last profile generated to users

Revision ID: 020edb3b3a22
Revises: 20af80d894bd
Create Date: 2024-01-17 14:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '020edb3b3a22'
down_revision: Union[str, None] = '20af80d894bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add last_profile_generated column to users table
    op.add_column('users', sa.Column('last_profile_generated', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove last_profile_generated column from users table
    op.drop_column('users', 'last_profile_generated') 