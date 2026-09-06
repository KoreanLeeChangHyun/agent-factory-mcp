"""Add metadata-only Drive reference collection state.

Revision ID: 0023
Revises: 0022
"""

import sqlalchemy as sa
from alembic import op

revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('integration_collections', sa.Column('mode', sa.String(20), nullable=False, server_default='content'))
    op.add_column('integration_collections', sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('integration_collections', sa.Column('last_refresh_status', sa.String(30)))
    op.add_column('integration_collections', sa.Column('last_refreshed_at', sa.DateTime(timezone=True)))
    op.add_column('integration_collections', sa.Column('last_error_code', sa.String(100)))
    op.create_check_constraint('collection_mode', 'integration_collections', "mode IN ('content', 'reference')")
    op.add_column('integration_source_mappings', sa.Column('source_url', sa.String(2048)))
    op.add_column('integration_source_mappings', sa.Column('source_metadata', sa.JSON(), nullable=False, server_default='{}'))
    op.add_column('integration_source_mappings', sa.Column('metadata_hash', sa.String(64)))
    op.add_column('integration_source_mappings', sa.Column('source_status', sa.String(30), nullable=False, server_default='active'))
    op.add_column('integration_source_mappings', sa.Column('last_seen_at', sa.DateTime(timezone=True)))
    op.create_check_constraint('source_mapping_status', 'integration_source_mappings',
                               "source_status IN ('active', 'missing', 'inaccessible')")


def downgrade():
    op.drop_constraint('source_mapping_status', 'integration_source_mappings', type_='check')
    for column in ('last_seen_at', 'source_status', 'metadata_hash', 'source_metadata', 'source_url'):
        op.drop_column('integration_source_mappings', column)
    op.drop_constraint('collection_mode', 'integration_collections', type_='check')
    for column in ('last_error_code', 'last_refreshed_at', 'last_refresh_status', 'is_enabled', 'mode'):
        op.drop_column('integration_collections', column)
