from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import NoReturn
from uuid import UUID, uuid4

from agent_factory_core.workbenches import (
    ValidatedWorkbench,
    WorkbenchActor,
    WorkbenchArchivedError,
    WorkbenchConflictError,
    WorkbenchDefinitionAggregate,
    WorkbenchDefinitionState,
    WorkbenchIdempotencyError,
    WorkbenchRelease,
)
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresWorkbenchRepository:
    def __init__(
        self, session: AsyncSession, *, request_id: str | None = None, source: str = "http"
    ) -> None:
        self.session, self.request_id, self.source = session, request_id, source

    async def _scope(self, actor: WorkbenchActor) -> None:
        for key, value in {
            "app.current_user_id": actor.user_id,
            "app.current_organization_id": actor.organization_id,
            "app.current_workspace_id": actor.workspace_id,
            "app.is_platform_admin": "false",
        }.items():
            await self.session.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": str(value)}
            )

    @staticmethod
    def _definition(row: Mapping[str, object]) -> WorkbenchDefinitionAggregate:
        draft = row["draft"]
        assert isinstance(draft, Mapping)
        return WorkbenchDefinitionAggregate(
            id=UUID(str(row["id"])),
            organization_id=UUID(str(row["organization_id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            key=str(row["definition_key"]),
            title=str(row["title"]),
            state=WorkbenchDefinitionState(str(row["state"])),
            revision=int(str(row["revision"])),
            draft=dict(draft),
            latest_release_id=UUID(str(row["latest_release_id"]))
            if row["latest_release_id"]
            else None,
            created_by=UUID(str(row["created_by"])),
            updated_by=UUID(str(row["updated_by"])),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            archived_at=row["archived_at"],  # type: ignore[arg-type]
        )

    @staticmethod
    def _release(row: Mapping[str, object]) -> WorkbenchRelease:
        snapshot = row["snapshot"]
        assert isinstance(snapshot, Mapping)
        return WorkbenchRelease(
            id=UUID(str(row["id"])),
            organization_id=UUID(str(row["organization_id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            definition_id=UUID(str(row["definition_id"])),
            definition_revision=int(str(row["definition_revision"])),
            release_number=int(str(row["release_number"])),
            schema_version=str(row["schema_version"]),
            schema_digest=str(row["schema_digest"]),
            asset_version=str(row["asset_version"]),
            definition_digest=str(row["definition_digest"]),
            snapshot=dict(snapshot),
            published_by=UUID(str(row["published_by"])),
            published_at=row["published_at"],  # type: ignore[arg-type]
        )

    async def list_definitions(
        self, actor: WorkbenchActor, *, include_archived: bool = False
    ) -> Sequence[WorkbenchDefinitionAggregate]:
        await self._scope(actor)
        result = await self.session.execute(
            text(
                "SELECT * FROM workbench_definitions WHERE workspace_id=:workspace_id AND (:include_archived OR state='draft') ORDER BY created_at, id"
            ),
            {"workspace_id": actor.workspace_id, "include_archived": include_archived},
        )
        return [self._definition(row) for row in result.mappings()]

    async def get_definition(
        self, actor: WorkbenchActor, definition_id: UUID, *, include_archived: bool = False
    ) -> WorkbenchDefinitionAggregate | None:
        await self._scope(actor)
        result = await self.session.execute(
            text(
                "SELECT * FROM workbench_definitions WHERE id=:id AND workspace_id=:workspace_id AND (:include_archived OR state='draft')"
            ),
            {
                "id": definition_id,
                "workspace_id": actor.workspace_id,
                "include_archived": include_archived,
            },
        )
        row = result.mappings().one_or_none()
        return self._definition(row) if row else None

    async def create_definition(
        self, actor: WorkbenchActor, *, key: str, title: str, validated: ValidatedWorkbench
    ) -> WorkbenchDefinitionAggregate:
        await self._scope(actor)
        try:
            result = await self.session.execute(
                text(
                    "INSERT INTO workbench_definitions (id,organization_id,workspace_id,definition_key,title,state,revision,draft,created_by,updated_by) VALUES (:id,:organization_id,:workspace_id,:key,:title,'draft',1,CAST(:draft AS jsonb),:user_id,:user_id) RETURNING *"
                ),
                {
                    "id": uuid4(),
                    "organization_id": actor.organization_id,
                    "workspace_id": actor.workspace_id,
                    "key": key,
                    "title": title,
                    "draft": json.dumps(dict(validated.definition), ensure_ascii=False),
                    "user_id": actor.user_id,
                },
            )
        except IntegrityError as error:
            await self.session.rollback()
            await self._scope(actor)
            revision = await self.session.scalar(
                text(
                    "SELECT revision FROM workbench_definitions WHERE workspace_id=:workspace_id AND definition_key=:key"
                ),
                {"workspace_id": actor.workspace_id, "key": key},
            )
            raise WorkbenchConflictError(int(revision or 0)) from error
        row = result.mappings().one()
        await self._audit(
            actor, "workbench.definition.create", UUID(str(row["id"])), {"revision": 1}
        )
        await self.session.commit()
        return self._definition(row)

    async def update_definition(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        *,
        title: str,
        validated: ValidatedWorkbench,
        expected_revision: int,
    ) -> WorkbenchDefinitionAggregate:
        await self._scope(actor)
        result = await self.session.execute(
            text(
                "UPDATE workbench_definitions SET title=:title,draft=CAST(:draft AS jsonb),revision=revision+1,updated_by=:user_id,updated_at=now() WHERE id=:id AND workspace_id=:workspace_id AND state='draft' AND revision=:revision RETURNING *"
            ),
            {
                "title": title,
                "draft": json.dumps(dict(validated.definition), ensure_ascii=False),
                "user_id": actor.user_id,
                "id": definition_id,
                "workspace_id": actor.workspace_id,
                "revision": expected_revision,
            },
        )
        row = result.mappings().one_or_none()
        if row is None:
            await self._raise_write_failure(actor, definition_id, expected_revision)
        assert row is not None
        await self._audit(
            actor, "workbench.definition.update", definition_id, {"revision": row["revision"]}
        )
        await self.session.commit()
        return self._definition(row)

    async def set_archived(
        self, actor: WorkbenchActor, definition_id: UUID, *, archived: bool, expected_revision: int
    ) -> WorkbenchDefinitionAggregate:
        await self._scope(actor)
        target, source = ("archived", "draft") if archived else ("draft", "archived")
        result = await self.session.execute(
            text(
                "UPDATE workbench_definitions SET state=CAST(:target AS varchar),archived_at=CASE WHEN CAST(:target AS varchar)='archived' THEN now() ELSE NULL END,revision=revision+1,updated_by=:user_id,updated_at=now() WHERE id=:id AND workspace_id=:workspace_id AND state=CAST(:source AS varchar) AND revision=:revision RETURNING *"
            ),
            {
                "target": target,
                "source": source,
                "user_id": actor.user_id,
                "id": definition_id,
                "workspace_id": actor.workspace_id,
                "revision": expected_revision,
            },
        )
        row = result.mappings().one_or_none()
        if row is None:
            await self._raise_write_failure(
                actor, definition_id, expected_revision, include_archived=True
            )
        assert row is not None
        await self._audit(
            actor, f"workbench.definition.{target}", definition_id, {"revision": row["revision"]}
        )
        await self.session.commit()
        return self._definition(row)

    async def publish(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        *,
        validated: ValidatedWorkbench,
        expected_revision: int,
        request_key: str,
        command_digest: str,
    ) -> WorkbenchRelease:
        await self._scope(actor)
        existing = await self.session.execute(
            text(
                "SELECT p.command_digest,r.* FROM workbench_publish_receipts p JOIN workbench_releases r ON r.id=p.release_id WHERE p.workspace_id=:workspace_id AND p.request_key=:request_key"
            ),
            {"workspace_id": actor.workspace_id, "request_key": request_key},
        )
        receipt = existing.mappings().one_or_none()
        if receipt:
            if receipt["command_digest"] != command_digest:
                raise WorkbenchIdempotencyError(request_key)
            return self._release(receipt)
        current_result = await self.session.execute(
            text(
                "SELECT * FROM workbench_definitions WHERE id=:id AND workspace_id=:workspace_id FOR UPDATE"
            ),
            {"id": definition_id, "workspace_id": actor.workspace_id},
        )
        current = current_result.mappings().one_or_none()
        if current is None:
            raise WorkbenchConflictError(0)
        if current["state"] != "draft":
            raise WorkbenchArchivedError(str(definition_id))
        if current["revision"] != expected_revision:
            raise WorkbenchConflictError(int(current["revision"]))
        if dict(current["draft"]) != dict(validated.definition):
            raise WorkbenchConflictError(int(current["revision"]))
        next_number = int(
            (
                await self.session.scalar(
                    text(
                        "SELECT COALESCE(MAX(release_number),0)+1 FROM workbench_releases WHERE definition_id=:id"
                    ),
                    {"id": definition_id},
                )
            )
            or 1
        )
        release_id = uuid4()
        try:
            result = await self.session.execute(
                text(
                    "INSERT INTO workbench_releases (id,organization_id,workspace_id,definition_id,definition_revision,release_number,schema_version,schema_digest,asset_version,definition_digest,snapshot,published_by) VALUES (:id,:organization_id,:workspace_id,:definition_id,:definition_revision,:release_number,:schema_version,:schema_digest,:asset_version,:definition_digest,CAST(:snapshot AS jsonb),:published_by) RETURNING *"
                ),
                {
                    "id": release_id,
                    "organization_id": actor.organization_id,
                    "workspace_id": actor.workspace_id,
                    "definition_id": definition_id,
                    "definition_revision": expected_revision,
                    "release_number": next_number,
                    "schema_version": validated.schema_version,
                    "schema_digest": validated.schema_digest,
                    "asset_version": validated.asset_version,
                    "definition_digest": validated.definition_digest,
                    "snapshot": json.dumps(dict(validated.definition), ensure_ascii=False),
                    "published_by": actor.user_id,
                },
            )
            row = result.mappings().one()
            await self.session.execute(
                text(
                    "INSERT INTO workbench_publish_receipts (workspace_id,request_key,command_digest,release_id) VALUES (:workspace_id,:request_key,:command_digest,:release_id)"
                ),
                {
                    "workspace_id": actor.workspace_id,
                    "request_key": request_key,
                    "command_digest": command_digest,
                    "release_id": release_id,
                },
            )
            await self.session.execute(
                text("UPDATE workbench_definitions SET latest_release_id=:release_id WHERE id=:id"),
                {"release_id": release_id, "id": definition_id},
            )
            await self._audit(
                actor,
                "workbench.release.publish",
                release_id,
                {
                    "definitionId": str(definition_id),
                    "definitionRevision": expected_revision,
                    "releaseNumber": next_number,
                },
            )
            await self.session.commit()
            return self._release(row)
        except IntegrityError:
            await self.session.rollback()
            await self._scope(actor)
            repeated = await self.session.execute(
                text(
                    "SELECT p.command_digest,r.* FROM workbench_publish_receipts p JOIN workbench_releases r ON r.id=p.release_id WHERE p.workspace_id=:workspace_id AND p.request_key=:request_key"
                ),
                {"workspace_id": actor.workspace_id, "request_key": request_key},
            )
            repeated_row = repeated.mappings().one_or_none()
            if repeated_row and repeated_row["command_digest"] == command_digest:
                return self._release(repeated_row)
            raise WorkbenchConflictError(expected_revision)

    async def list_releases(
        self, actor: WorkbenchActor, definition_id: UUID
    ) -> Sequence[WorkbenchRelease]:
        await self._scope(actor)
        result = await self.session.execute(
            text(
                "SELECT * FROM workbench_releases WHERE workspace_id=:workspace_id AND definition_id=:definition_id ORDER BY release_number DESC"
            ),
            {"workspace_id": actor.workspace_id, "definition_id": definition_id},
        )
        return [self._release(row) for row in result.mappings()]

    async def get_release(self, actor: WorkbenchActor, release_id: UUID) -> WorkbenchRelease | None:
        await self._scope(actor)
        result = await self.session.execute(
            text("SELECT * FROM workbench_releases WHERE id=:id AND workspace_id=:workspace_id"),
            {"id": release_id, "workspace_id": actor.workspace_id},
        )
        row = result.mappings().one_or_none()
        return self._release(row) if row else None

    async def _raise_write_failure(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        expected_revision: int,
        *,
        include_archived: bool = False,
    ) -> NoReturn:
        await self.session.rollback()
        current = await self.get_definition(actor, definition_id, include_archived=include_archived)
        raise WorkbenchConflictError(current.revision if current else 0)

    async def _audit(
        self, actor: WorkbenchActor, action: str, target_id: UUID, metadata: Mapping[str, object]
    ) -> None:
        for key, value in {
            "app.workbench_audit_action": action,
            "app.workbench_audit_source": self.source,
            "app.workbench_audit_target_id": target_id,
        }.items():
            await self.session.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": str(value)}
            )
        await self.session.execute(
            text(
                "INSERT INTO audit_events (id,occurred_at,organization_id,workspace_id,actor_user_id,action,target_type,target_id,outcome,request_id,source,event_metadata) VALUES (gen_random_uuid(),now(),:organization_id,:workspace_id,:user_id,:action,'workbench',:target_id,'success',:request_id,:source,CAST(:metadata AS jsonb))"
            ),
            {
                "organization_id": actor.organization_id,
                "workspace_id": actor.workspace_id,
                "user_id": actor.user_id,
                "action": action,
                "target_id": str(target_id),
                "request_id": self.request_id,
                "source": self.source,
                "metadata": json.dumps(metadata, separators=(",", ":")),
            },
        )
