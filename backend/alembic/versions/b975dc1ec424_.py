"""empty message

Revision ID: b975dc1ec424
Revises: 020edb3b3a22, add_auth0_fields_to_user
Create Date: 2025-01-18 01:38:26.474090

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b975dc1ec424'
down_revision: Union[str, None] = ('020edb3b3a22', 'add_auth0_fields_to_user')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 