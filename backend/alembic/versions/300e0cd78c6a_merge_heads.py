"""merge heads

Revision ID: 300e0cd78c6a
Revises: 4a5ab2d8b88a, add_has_attachments
Create Date: 2025-01-13 20:03:08.616043

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '300e0cd78c6a'
down_revision: Union[str, None] = ('4a5ab2d8b88a', 'add_has_attachments')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 