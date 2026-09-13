"""Transaction-local PostgreSQL tenant context."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class TenantContext:
    user_id: UUID
    organization_id: UUID
    workspace_id: UUID | None = None
    is_platform_admin: bool = False


async def apply_tenant_context(session: AsyncSession, tenant: TenantContext) -> None:
    """Apply values consumed by RLS policies for the current transaction only."""

    values = {
        "app.current_user_id": str(tenant.user_id),
        "app.current_organization_id": str(tenant.organization_id),
        "app.current_workspace_id": str(tenant.workspace_id or ""),
        "app.is_platform_admin": "true" if tenant.is_platform_admin else "false",
    }
    for key, value in values.items():
        await session.execute(
            text("SELECT set_config(:key, :value, true)"),
            {"key": key, "value": value},
        )


def install_tenant_context(session: AsyncSession, tenant: TenantContext) -> None:
    """Reapply one immutable tenant identity whenever the session opens a transaction."""
    values = {
        "app.current_user_id": str(tenant.user_id),
        "app.current_organization_id": str(tenant.organization_id),
        "app.current_workspace_id": str(tenant.workspace_id or ""),
        "app.is_platform_admin": "true" if tenant.is_platform_admin else "false",
    }
    existing = session.info.get("target_tenant_context")
    if existing is not None and existing != values:
        raise ValueError("session cannot change target tenant identity")
    if existing is not None:
        return
    session.info["target_tenant_context"] = values

    def establish(sync_session, transaction, connection):
        del sync_session, transaction
        for key, value in values.items():
            connection.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": value}
            )

    event.listen(session.sync_session, "after_begin", establish)
