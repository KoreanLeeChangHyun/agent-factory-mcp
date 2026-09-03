"""Add provider catalog, encrypted connections, OAuth, and webhooks.

Revision ID: 0008
Revises: 0007
"""

from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

PROVIDERS = {
    "google-drive": UUID("10000000-0000-4000-8000-000000000001"),
    "gmail": UUID("10000000-0000-4000-8000-000000000002"),
    "slack": UUID("10000000-0000-4000-8000-000000000003"),
    "notion": UUID("10000000-0000-4000-8000-000000000004"),
    "discord": UUID("10000000-0000-4000-8000-000000000005"),
    "onedrive": UUID("10000000-0000-4000-8000-000000000006"),
}


def _timestamps() -> tuple[sa.Column[object], sa.Column[object]]:
    return (
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def _workspace_id() -> sa.Column[object]:
    return sa.Column(
        "workspace_id",
        sa.Uuid(),
        sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )


def _enable_rls(table: str) -> None:
    expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid"
    )
    op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY workspace_isolation ON "{table}" '
        f"USING ({expression}) WITH CHECK ({expression})"
    )


def upgrade() -> None:
    op.create_table(
        "integration_providers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("key", sa.String(80), nullable=False, unique=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("auth_type", sa.String(30), nullable=False),
        sa.Column("capabilities", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("configuration_schema", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "auth_type IN ('oauth2', 'api_key', 'service_account')", name="auth_type"
        ),
    )
    op.create_index("ix_integration_providers_key", "integration_providers", ["key"])
    for key, provider_id in PROVIDERS.items():
        display_name = key.replace("-", " ").title()
        op.execute(
            "INSERT INTO integration_providers "
            "(id, key, display_name, auth_type, capabilities, configuration_schema, is_enabled) "
            f"VALUES ('{provider_id}', '{key}', '{display_name}', 'oauth2', "
            "'[\"collect\", \"refresh\"]'::json, '{}'::json, true)"
        )
    op.create_table(
        "integration_connections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        _workspace_id(),
        sa.Column(
            "provider_id",
            sa.Uuid(),
            sa.ForeignKey("integration_providers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("encrypted_credentials", sa.LargeBinary()),
        sa.Column("encryption_key_version", sa.Integer()),
        sa.Column("external_account_id", sa.String(500)),
        sa.Column("sync_cursor", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("last_error_code", sa.String(120)),
        sa.Column("last_error_message", sa.Text()),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'degraded', 'disconnected')", name="connection_status"
        ),
        sa.UniqueConstraint("workspace_id", "provider_id", "name"),
    )
    op.create_index(
        "ix_integration_connections_workspace_id", "integration_connections", ["workspace_id"]
    )
    op.create_index(
        "ix_integration_connections_provider_id", "integration_connections", ["provider_id"]
    )
    op.create_table(
        "integration_oauth_states",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "provider_id",
            sa.Uuid(),
            sa.ForeignKey("integration_providers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("state_digest", sa.LargeBinary(32), nullable=False, unique=True),
        sa.Column("encrypted_pkce_verifier", sa.LargeBinary(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_integration_oauth_states_workspace_id", "integration_oauth_states", ["workspace_id"]
    )
    op.create_table(
        "webhook_endpoints",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        _workspace_id(),
        sa.Column(
            "connection_id",
            sa.Uuid(),
            sa.ForeignKey("integration_connections.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("public_id", sa.String(80), nullable=False, unique=True),
        sa.Column("encrypted_signing_secret", sa.LargeBinary(), nullable=False),
        sa.Column("encryption_key_version", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_webhook_endpoints_workspace_id", "webhook_endpoints", ["workspace_id"])
    op.create_index("ix_webhook_endpoints_public_id", "webhook_endpoints", ["public_id"])
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "webhook_endpoint_id",
            sa.Uuid(),
            sa.ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_event_id", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("signature_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'succeeded', 'failed', 'dead')",
            name="delivery_status",
        ),
        sa.UniqueConstraint("webhook_endpoint_id", "provider_event_id"),
    )
    op.create_index("ix_webhook_deliveries_workspace_id", "webhook_deliveries", ["workspace_id"])
    op.create_index(
        "ix_webhook_deliveries_webhook_endpoint_id", "webhook_deliveries", ["webhook_endpoint_id"]
    )
    for table in ("integration_connections", "integration_oauth_states", "webhook_deliveries"):
        _enable_rls(table)
    workspace_expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid"
    )
    public_expression = (
        "public_id = NULLIF(current_setting('app.current_webhook_public_id', true), '')"
    )
    op.execute('ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "webhook_endpoints" FORCE ROW LEVEL SECURITY')
    op.execute(
        'CREATE POLICY webhook_endpoint_read ON "webhook_endpoints" FOR SELECT '
        f"USING ({workspace_expression} OR {public_expression})"
    )
    op.execute(
        'CREATE POLICY webhook_endpoint_write ON "webhook_endpoints" FOR ALL '
        f"USING ({workspace_expression}) WITH CHECK ({workspace_expression})"
    )


def downgrade() -> None:
    for table in (
        "webhook_deliveries",
        "webhook_endpoints",
        "integration_oauth_states",
        "integration_connections",
        "integration_providers",
    ):
        op.drop_table(table)
