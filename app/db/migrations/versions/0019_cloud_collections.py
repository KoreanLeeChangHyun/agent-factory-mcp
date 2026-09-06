"""Cloud collection selections, independent run cursors, and Original mappings."""

import sqlalchemy as sa
from alembic import op

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def common():
    return [sa.Column('id', sa.Uuid(), primary_key=True),
            sa.Column('workspace_id', sa.Uuid(), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]


def upgrade():
    op.create_table('integration_cloud_connection_states', *common(),
                    sa.Column('connection_id', sa.Uuid(), sa.ForeignKey('integration_connections.id', ondelete='CASCADE'), nullable=False),
                    sa.Column('requested_scopes', sa.JSON(), nullable=False),
                    sa.Column('granted_scopes', sa.JSON()),
                    sa.Column('inspection', sa.JSON(), nullable=False),
                    sa.Column('inspected_at', sa.DateTime(timezone=True)),
                    sa.UniqueConstraint('workspace_id', 'connection_id'))
    op.create_table('integration_collections', *common(),
                    sa.Column('connection_id', sa.Uuid(), sa.ForeignKey('integration_connections.id', ondelete='RESTRICT'), nullable=False),
                    sa.Column('provider', sa.String(30), nullable=False),
                    sa.Column('name', sa.String(160), nullable=False),
                    sa.Column('selection', sa.JSON(), nullable=False),
                    sa.Column('created_by_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
                    sa.UniqueConstraint('workspace_id', 'connection_id', 'name'))
    op.create_table('integration_collection_runs', *common(),
                    sa.Column('collection_id', sa.Uuid(), sa.ForeignKey('integration_collections.id', ondelete='RESTRICT'), nullable=False),
                    sa.Column('requested_by_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
                    sa.Column('request_key', sa.String(160), nullable=False),
                    sa.Column('job_id', sa.Uuid(), sa.ForeignKey('jobs.id', ondelete='SET NULL')),
                    sa.Column('status', sa.String(30), nullable=False),
                    sa.Column('cursor', sa.JSON(), nullable=False),
                    sa.Column('results', sa.JSON(), nullable=False),
                    sa.Column('examined', sa.Integer(), nullable=False),
                    sa.Column('pages', sa.Integer(), nullable=False),
                    sa.Column('bytes_read', sa.Integer(), nullable=False),
                    sa.Column('cancel_requested', sa.Boolean(), nullable=False),
                    sa.Column('error_code', sa.String(100)),
                    sa.Column('finished_at', sa.DateTime(timezone=True)),
                    sa.UniqueConstraint('workspace_id', 'collection_id', 'request_key'))
    op.create_table('integration_source_mappings', *common(),
                    sa.Column('collection_id', sa.Uuid(), sa.ForeignKey('integration_collections.id', ondelete='RESTRICT'), nullable=False),
                    sa.Column('source_id', sa.String(500), nullable=False),
                    sa.Column('document_id', sa.Uuid(), sa.ForeignKey('documents.id', ondelete='RESTRICT'), nullable=False),
                    sa.Column('content_hash', sa.String(64)),
                    sa.Column('revision_number', sa.Integer()),
                    sa.UniqueConstraint('workspace_id', 'collection_id', 'source_id'))
    for table in ('integration_cloud_connection_states', 'integration_collections',
                  'integration_collection_runs', 'integration_source_mappings'):
        op.create_index(f'ix_{table}_workspace_id', table, ['workspace_id'])
        expression = ("current_setting('app.is_platform_admin', true) = 'true' OR "
                      "workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        op.execute(f'CREATE POLICY workspace_isolation ON "{table}" USING ({expression}) WITH CHECK ({expression})')


def downgrade():
    for table in ('integration_source_mappings', 'integration_collection_runs',
                  'integration_collections', 'integration_cloud_connection_states'):
        op.drop_table(table)
