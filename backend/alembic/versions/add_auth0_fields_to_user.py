"""add_auth0_fields_to_user

Revision ID: add_auth0_fields_to_user
Revises: 
Create Date: 2024-01-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_auth0_fields_to_user'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add auth0_id column
    op.add_column('users', sa.Column('auth0_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_auth0_id'), 'users', ['auth0_id'], unique=True)
    
    # Make hashed_password nullable
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(),
                    nullable=True)
    
    # Make full_name nullable
    op.alter_column('users', 'full_name',
                    existing_type=sa.String(),
                    nullable=True)


def downgrade():
    # Remove auth0_id column and index
    op.drop_index(op.f('ix_users_auth0_id'), table_name='users')
    op.drop_column('users', 'auth0_id')
    
    # Make hashed_password non-nullable
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(),
                    nullable=False)
    
    # Make full_name non-nullable
    op.alter_column('users', 'full_name',
                    existing_type=sa.String(),
                    nullable=False) 