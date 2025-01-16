"""add description to files

Revision ID: 2c1cbdc7087f
Revises: e394dea4a31b
Create Date: 2024-01-16 12:34:56.789012

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c1cbdc7087f'
down_revision: Union[str, None] = 'e394dea4a31b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add description column to files table
    op.add_column('files', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove description column from files table
    op.drop_column('files', 'description') 