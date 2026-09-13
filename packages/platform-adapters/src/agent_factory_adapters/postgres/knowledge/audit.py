from __future__ import annotations

import json
from collections.abc import Mapping
from uuid import UUID, uuid4

from agent_factory_core.knowledge.domain import KnowledgeActor
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def append_knowledge_audit(
    session: AsyncSession,
    actor: KnowledgeActor,
    *,
    action: str,
    target_type: str,
    target_id: UUID,
    request_id: str | None,
    source: str,
    metadata: Mapping[str, object] | None = None,
) -> None:
    """Append atomically under the dedicated tenant-scoped audit policy."""
    await session.execute(
        text(
            "INSERT INTO audit_events "
            "(id, occurred_at, actor_user_id, organization_id, workspace_id, action, "
            "target_type, target_id, outcome, request_id, source, event_metadata) VALUES "
            "(:id, now(), :actor_user_id, :organization_id, :workspace_id, :action, "
            ":target_type, :target_id, 'success', :request_id, :source, CAST(:metadata AS jsonb))"
        ),
        {
            "id": uuid4(),
            "actor_user_id": actor.user_id,
            "organization_id": actor.organization_id,
            "workspace_id": actor.workspace_id,
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id),
            "request_id": request_id,
            "source": source,
            "metadata": json.dumps(dict(metadata or {}), separators=(",", ":")),
        },
    )
