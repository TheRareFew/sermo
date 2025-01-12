"""add has_attachments to messages

Revision ID: add_has_attachments
Revises: ffd99aecd4ab
Create Date: 2024-01-10 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_has_attachments'
down_revision: Union[str, None] = 'ffd99aecd4ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add has_attachments column
    op.add_column('messages', sa.Column('has_attachments', sa.Boolean(), nullable=False, server_default='false'))
    
    # Update existing messages based on file relationships
    op.execute("""
        UPDATE messages 
        SET has_attachments = EXISTS (
            SELECT 1 
            FROM files 
            WHERE files.message_id = messages.id
        )
    """)


def downgrade() -> None:
    op.drop_column('messages', 'has_attachments') 