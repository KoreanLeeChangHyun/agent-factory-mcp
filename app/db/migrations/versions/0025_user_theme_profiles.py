"""Persist validated per-user theme profiles.

Revision ID: 0025
Revises: 0024
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_theme_profiles",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("base", sa.String(24), nullable=False, server_default="dark"),
        sa.Column("density", sa.String(24), nullable=False, server_default="compact"),
        sa.Column(
            "overrides",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("reduced_motion", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("revision >= 1", name="theme_profile_positive_revision"),
        sa.CheckConstraint("base IN ('dark', 'light', 'high-contrast')", name="theme_profile_base"),
        sa.CheckConstraint("density IN ('compact', 'comfortable')", name="theme_profile_density"),
        sa.CheckConstraint(
            "jsonb_typeof(overrides) = 'object' AND "
            "overrides - ARRAY['accent', 'focus', 'surface', 'text']::text[] = '{}'::jsonb AND "
            "octet_length(overrides::text) <= 256",
            name="theme_profile_override_bounds",
        ),
    )
    scope = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid"
    )
    op.execute('ALTER TABLE "user_theme_profiles" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "user_theme_profiles" FORCE ROW LEVEL SECURITY')
    op.execute(
        'CREATE POLICY user_theme_profile_isolation ON "user_theme_profiles" '
        f"USING ({scope}) WITH CHECK ({scope})"
    )


def downgrade() -> None:
    op.drop_table("user_theme_profiles")
