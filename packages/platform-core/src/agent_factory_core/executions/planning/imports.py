from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import ConflictError, NotFoundError


@dataclass(frozen=True, slots=True)
class ImportPreview:
    id: UUID
    workspace_id: UUID
    request_key: str
    proposal: dict[str, object]
    preview: dict[str, object]
    baseline: str
    digest: str
    result: dict[str, object] | None = None
    created_at: datetime | None = None


class PlanningImportRepository(Protocol):
    async def by_request_key(
        self, workspace_id: UUID, request_key: str
    ) -> ImportPreview | None: ...
    async def get_preview(self, workspace_id: UUID, import_id: UUID) -> ImportPreview | None: ...
    async def planning_snapshot_digest(self, workspace_id: UUID) -> str: ...
    async def create_preview(
        self,
        workspace_id: UUID,
        request_key: str,
        proposal: dict[str, object],
        proposal_digest: str,
        baseline: str,
    ) -> ImportPreview: ...
    async def apply_preview(self, preview: ImportPreview) -> dict[str, object]: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


def stable_digest(value: object) -> str:
    body = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()


class PlanningImports:
    """Framework-free preview/apply boundary; the adapter performs one atomic hierarchy transaction."""

    def __init__(self, repository: PlanningImportRepository) -> None:
        self.repository = repository

    async def preview(
        self, context: AuthorizedContext, proposal: dict[str, object]
    ) -> ImportPreview:
        require_context(context, "planning.import")
        workspace_id = require_workspace_id(context)
        request_key = proposal.get("request_key")
        items = proposal.get("items")
        if not isinstance(request_key, str) or not request_key.strip():
            raise ConflictError("invalid_request_key", "Import request_key is required")
        if not isinstance(items, list) or len(items) > 500:
            raise ConflictError("import_size_limit", "An import may contain at most 500 items")
        digest = stable_digest(proposal)
        existing = await self.repository.by_request_key(workspace_id, request_key)
        if existing:
            if stable_digest(existing.proposal) != digest:
                raise ConflictError(
                    "request_key_conflict", "request_key was used for different content"
                )
            return existing
        baseline = await self.repository.planning_snapshot_digest(workspace_id)
        try:
            result = await self.repository.create_preview(
                workspace_id, request_key, proposal, digest, baseline
            )
        except ConflictError:
            await self.repository.rollback()
            concurrent = await self.repository.by_request_key(workspace_id, request_key)
            if concurrent is None or stable_digest(concurrent.proposal) != digest:
                raise
            return concurrent
        await self.repository.commit()
        return result

    async def apply(
        self,
        context: AuthorizedContext,
        import_id: UUID,
        preview_digest: str,
        *,
        acknowledge_warnings: bool,
    ) -> dict[str, object]:
        require_context(context, "planning.import")
        workspace_id = require_workspace_id(context)
        preview = await self.repository.get_preview(workspace_id, import_id)
        if preview is None:
            raise NotFoundError("plan_import_not_found", "Planning import preview not found")
        if preview.digest != preview_digest:
            raise ConflictError("preview_digest_conflict", "Preview digest does not match")
        if preview.result is not None:
            return preview.result
        if preview.preview.get("questions"):
            raise ConflictError("unresolved_questions", "Resolve import questions in a new preview")
        if preview.preview.get("errors"):
            raise ConflictError(
                "import_invalid", "Resolve import validation errors in a new preview"
            )
        if preview.preview.get("warnings") and not acknowledge_warnings:
            raise ConflictError("warnings_not_acknowledged", "Import warnings must be acknowledged")
        if await self.repository.planning_snapshot_digest(workspace_id) != preview.baseline:
            # A concurrent apply of this exact preview changes the planning digest
            # while this caller waits for the Workspace lock. Re-read under that
            # lock so an idempotent replay returns its durable result.
            current = await self.repository.get_preview(workspace_id, import_id)
            if current is not None and current.result is not None:
                return current.result
            raise ConflictError("planning_changed", "Planning data changed after preview")
        try:
            result = await self.repository.apply_preview(preview)
            await self.repository.commit()
            return result
        except BaseException:
            await self.repository.rollback()
            raise
