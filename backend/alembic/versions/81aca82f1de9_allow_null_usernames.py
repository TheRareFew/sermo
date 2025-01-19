"""allow_null_usernames

Revision ID: 81aca82f1de9
Revises: b975dc1ec424
Create Date: 2024-01-19 01:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '81aca82f1de9'
down_revision: Union[str, None] = 'b975dc1ec424'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the not null constraint on username column
    op.alter_column('users', 'username',
               existing_type=sa.String(),
               nullable=True)


def downgrade() -> None:
    # Add back the not null constraint
    op.alter_column('users', 'username',
               existing_type=sa.String(),
               nullable=False) 