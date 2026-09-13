"""Best-effort append-only audit writer and reader."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from agent_factory_adapters.postgres.models.audit import AuditEvent


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def append(
        self,
        *,
        actor_user_id: UUID | None,
        organization_id: UUID | None,
        workspace_id: UUID | None,
        action: str,
        outcome: str,
        request_id: str | None,
        target_type: str | None = None,
        target_id: str | None = None,
        source: str = "http",
        metadata: dict[str, object] | None = None,
    ) -> AuditEvent:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        event = AuditEvent(
            occurred_at=datetime.now(UTC),
            actor_user_id=actor_user_id,
            organization_id=organization_id,
            workspace_id=workspace_id,
            action=action,
            outcome=outcome,
            request_id=request_id,
            target_type=target_type,
            target_id=target_id,
            source=source,
            event_metadata=metadata or {},
        )
        self.session.add(event)
        await self.session.commit()
        return event

    async def list(self, limit: int = 200, workspace_id: UUID | None = None) -> list[AuditEvent]:
        statement = select(AuditEvent)
        if workspace_id is not None:
            statement = statement.where(AuditEvent.workspace_id == workspace_id)
        return list(
            await self.session.scalars(
                statement.order_by(AuditEvent.occurred_at.desc()).limit(limit)
            )
        )
