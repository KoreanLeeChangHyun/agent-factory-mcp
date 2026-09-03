"""Transaction-local PostgreSQL tenant context."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text
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
