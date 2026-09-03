"""Allow authenticated users to discover their organizations.

Revision ID: 0011
Revises: 0010
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user = "NULLIF(current_setting('app.current_user_id', true), '')::uuid"
    op.execute(
        'CREATE POLICY own_membership_read ON "organization_memberships" FOR SELECT '
        f"USING (user_id = {user})"
    )
    op.execute(
        'CREATE POLICY member_organization_read ON "organizations" FOR SELECT '
        "USING (id IN (SELECT organization_id FROM organization_memberships "
        f"WHERE user_id = {user}))"
    )


def downgrade() -> None:
    op.execute('DROP POLICY member_organization_read ON "organizations"')
    op.execute('DROP POLICY own_membership_read ON "organization_memberships"')
