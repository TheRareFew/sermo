"""merge_heads

Revision ID: e394dea4a31b
Revises: a12986a78789, add_is_bot_to_messages
Create Date: 2025-01-15 18:25:04.095381

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e394dea4a31b'
down_revision: Union[str, None] = ('a12986a78789', 'add_is_bot_to_messages')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 