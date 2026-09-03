"""Create authentication credentials, sessions, and token records.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _timestamps() -> tuple[sa.Column[object], sa.Column[object]]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def _enable_user_rls(table: str) -> None:
    expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid"
    )
    op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY user_isolation ON "{table}" USING ({expression}) WITH CHECK ({expression})'
    )


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("identity_type", sa.String(20), nullable=False, server_default="human"),
    )
    op.create_check_constraint("identity_type", "users", "identity_type IN ('human', 'service')")
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))
    op.create_index(
        "uq_users_email_normalized",
        "users",
        [sa.text("lower(email)")],
        unique=True,
    )
    op.create_table(
        "user_credentials",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        *_timestamps(),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("password_changed_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "external_identities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("email_at_provider", sa.String(320)),
        sa.UniqueConstraint("provider", "subject"),
    )
    op.create_index("ix_external_identities_user_id", "external_identities", ["user_id"])
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_digest", sa.LargeBinary(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("user_agent", sa.String(500)),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_token_digest", "auth_sessions", ["token_digest"])
    op.create_table(
        "one_time_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(40), nullable=False),
        sa.Column("token_digest", sa.LargeBinary(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index("ix_one_time_tokens_user_id", "one_time_tokens", ["user_id"])
    op.create_index("ix_one_time_tokens_purpose", "one_time_tokens", ["purpose"])
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("token_digest", sa.LargeBinary(32), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index("ix_api_tokens_user_id", "api_tokens", ["user_id"])
    op.create_index("ix_api_tokens_token_digest", "api_tokens", ["token_digest"])
    op.create_table(
        "auth_factors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("encrypted_configuration", sa.LargeBinary(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "kind", "label"),
    )
    op.create_index("ix_auth_factors_user_id", "auth_factors", ["user_id"])

    for table in (
        "user_credentials",
        "external_identities",
        "auth_sessions",
        "one_time_tokens",
        "api_tokens",
        "auth_factors",
    ):
        _enable_user_rls(table)


def downgrade() -> None:
    for table in (
        "auth_factors",
        "api_tokens",
        "one_time_tokens",
        "auth_sessions",
        "external_identities",
        "user_credentials",
    ):
        op.drop_table(table)
    op.drop_index("uq_users_email_normalized", table_name="users")
    op.drop_column("users", "email_verified_at")
    op.drop_constraint("ck_users_identity_type", "users", type_="check")
    op.drop_column("users", "identity_type")
