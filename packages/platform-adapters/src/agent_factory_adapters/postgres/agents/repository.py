from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import asdict
from datetime import datetime
from typing import cast
from uuid import UUID, uuid4

from agent_factory_core.executions.agents.domain import (
    AgentDefinition,
    AgentRun,
    AgentStatus,
    AgentVersion,
    RunArtifact,
    RunDocumentLink,
    RunEvent,
    RunStatus,
    RunToolCall,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresAgentRepository:
    """Tenant-filtered adapter for the existing versioned Agent tables."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _definition(row: Mapping[str, object]) -> AgentDefinition:
        return AgentDefinition(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            str(row["name"]),
            str(row["slug"]),
            str(row["description"]),
            AgentStatus(str(row["status"])),
            int(str(row["current_version_number"])),
            int(str(row["revision"])),
        )

    @staticmethod
    def _version(row: Mapping[str, object]) -> AgentVersion:
        return AgentVersion(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["agent_definition_id"])),
            int(str(row["version_number"])),
            str(row["instructions"]),
            str(row["model"]),
            dict(cast(Mapping[str, object], row["configuration"])),
            tuple(str(value) for value in cast(list[object], row["allowed_tools"])),
            UUID(str(row["created_by_user_id"])),
            cast(datetime, row["created_at"]),
        )

    @staticmethod
    def _run(row: Mapping[str, object]) -> AgentRun:
        return AgentRun(
            id=UUID(str(row["id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            definition_id=UUID(str(row["agent_definition_id"])),
            version_id=UUID(str(row["agent_version_id"])),
            requested_by_user_id=UUID(str(row["requested_by_user_id"])),
            idempotency_key=str(row["idempotency_key"]),
            input_payload=dict(cast(Mapping[str, object], row["input_payload"])),
            status=RunStatus(str(row["status"])),
            retry_of_run_id=UUID(str(row["retry_of_run_id"])) if row["retry_of_run_id"] else None,
            output_payload=dict(cast(Mapping[str, object], row["output_payload"]))
            if row["output_payload"]
            else None,
            error_code=str(row["error_code"]) if row["error_code"] else None,
            error_message=str(row["error_message"]) if row["error_message"] else None,
            started_at=cast(datetime | None, row["started_at"]),
            finished_at=cast(datetime | None, row["finished_at"]),
            input_tokens=int(str(row["input_tokens"])),
            output_tokens=int(str(row["output_tokens"])),
            estimated_cost_usd=float(str(row["estimated_cost_usd"])),
            created_at=cast(datetime, row["created_at"]),
        )

    async def lock_workspace(self, organization_id: UUID, workspace_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text(
                    "SELECT EXISTS (SELECT 1 FROM workspaces WHERE id=:wid AND organization_id=:oid "
                    "AND status='active' AND deleted_at IS NULL FOR UPDATE)"
                ),
                {"wid": workspace_id, "oid": organization_id},
            )
        )

    async def list_definitions(self, workspace_id: UUID) -> list[AgentDefinition]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT * FROM agent_definitions WHERE workspace_id=:wid AND deleted_at IS NULL ORDER BY name,id"
                ),
                {"wid": workspace_id},
            )
        ).mappings()
        return [self._definition(row) for row in rows]

    async def get_definition(
        self, workspace_id: UUID, definition_id: UUID, *, lock: bool = False
    ) -> AgentDefinition | None:
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM agent_definitions WHERE workspace_id=:wid AND id=:id AND deleted_at IS NULL"
                        + (" FOR UPDATE" if lock else "")
                    ),
                    {"wid": workspace_id, "id": definition_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._definition(row) if row else None

    async def insert_definition(self, value: AgentDefinition) -> AgentDefinition:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_definitions
            (id,workspace_id,name,slug,description,status,current_version_number,revision)
            VALUES (:id,:workspace_id,:name,:slug,:description,:status,:current_version_number,:revision)
            RETURNING *"""),
                    {**self._dataclass(value), "status": value.status.value},
                )
            )
            .mappings()
            .one()
        )
        return self._definition(row)

    async def replace_definition(
        self, value: AgentDefinition, expected_revision: int
    ) -> AgentDefinition | None:
        row = (
            (
                await self.session.execute(
                    text("""UPDATE agent_definitions SET
            name=:name,description=:description,status=:status,revision=:revision,updated_at=now()
            WHERE id=:id AND workspace_id=:workspace_id AND revision=:expected_revision
            AND deleted_at IS NULL RETURNING *"""),
                    {
                        **self._dataclass(value),
                        "status": value.status.value,
                        "expected_revision": expected_revision,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._definition(row) if row else None

    async def soft_delete_definition(
        self, workspace_id: UUID, definition_id: UUID, expected_revision: int, now: datetime
    ) -> bool:
        result = await self.session.execute(
            text("""UPDATE agent_definitions SET deleted_at=:now,
            revision=revision+1,updated_at=:now WHERE workspace_id=:wid AND id=:id
            AND revision=:revision AND deleted_at IS NULL"""),
            {"now": now, "wid": workspace_id, "id": definition_id, "revision": expected_revision},
        )
        return bool(result.rowcount)

    async def list_versions(self, workspace_id: UUID, definition_id: UUID) -> list[AgentVersion]:
        rows = (
            await self.session.execute(
                text("""SELECT * FROM agent_versions
            WHERE workspace_id=:wid AND agent_definition_id=:did ORDER BY version_number DESC"""),
                {"wid": workspace_id, "did": definition_id},
            )
        ).mappings()
        return [self._version(row) for row in rows]

    async def get_version(
        self, workspace_id: UUID, definition_id: UUID, version_id: UUID | None
    ) -> AgentVersion | None:
        clause = "AND id=:vid" if version_id else "ORDER BY version_number DESC LIMIT 1"
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM agent_versions WHERE workspace_id=:wid "
                        "AND agent_definition_id=:did " + clause
                    ),
                    {"wid": workspace_id, "did": definition_id, "vid": version_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._version(row) if row else None

    async def insert_version(
        self, definition: AgentDefinition, value: AgentVersion
    ) -> AgentVersion:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_versions
            (id,workspace_id,agent_definition_id,version_number,instructions,model,configuration,allowed_tools,created_by_user_id)
            VALUES (:id,:workspace_id,:definition_id,:version_number,:instructions,:model,
            CAST(:configuration AS jsonb),CAST(:allowed_tools AS jsonb),:created_by_user_id) RETURNING *"""),
                    {
                        **self._dataclass(value),
                        "configuration": json.dumps(value.configuration),
                        "allowed_tools": json.dumps(value.allowed_tools),
                    },
                )
            )
            .mappings()
            .one()
        )
        await self.session.execute(
            text("""UPDATE agent_definitions SET current_version_number=:number,
            revision=revision+1,updated_at=now() WHERE id=:id AND workspace_id=:wid"""),
            {"number": value.version_number, "id": definition.id, "wid": definition.workspace_id},
        )
        return self._version(row)

    async def list_runs(self, workspace_id: UUID, limit: int = 100) -> list[AgentRun]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT * FROM agent_runs WHERE workspace_id=:wid ORDER BY created_at DESC,id LIMIT :limit"
                ),
                {"wid": workspace_id, "limit": limit},
            )
        ).mappings()
        return [self._run(row) for row in rows]

    async def get_run(
        self, workspace_id: UUID, run_id: UUID, *, lock: bool = False
    ) -> AgentRun | None:
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM agent_runs WHERE workspace_id=:wid AND id=:id"
                        + (" FOR UPDATE" if lock else "")
                    ),
                    {"wid": workspace_id, "id": run_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._run(row) if row else None

    async def find_run(self, workspace_id: UUID, idempotency_key: str) -> AgentRun | None:
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM agent_runs WHERE workspace_id=:wid AND idempotency_key=:key"
                    ),
                    {"wid": workspace_id, "key": idempotency_key},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._run(row) if row else None

    async def insert_run(self, value: AgentRun) -> AgentRun:
        values = self._dataclass(value)
        values.update(status=value.status.value, input_payload=json.dumps(value.input_payload))
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_runs
            (id,workspace_id,agent_definition_id,agent_version_id,requested_by_user_id,retry_of_run_id,
            status,idempotency_key,input_payload,input_tokens,output_tokens,estimated_cost_usd)
            VALUES (:id,:workspace_id,:definition_id,:version_id,:requested_by_user_id,:retry_of_run_id,
            :status,:idempotency_key,CAST(:input_payload AS jsonb),:input_tokens,:output_tokens,:estimated_cost_usd)
            RETURNING *"""),
                    values,
                )
            )
            .mappings()
            .one()
        )
        return self._run(row)

    async def replace_run(self, value: AgentRun) -> AgentRun:
        values = self._dataclass(value)
        values.update(
            status=value.status.value,
            output_payload=json.dumps(value.output_payload)
            if value.output_payload is not None
            else None,
        )
        row = (
            (
                await self.session.execute(
                    text("""UPDATE agent_runs SET status=:status,
            output_payload=CAST(:output_payload AS jsonb),error_code=:error_code,error_message=:error_message,
            started_at=:started_at,finished_at=:finished_at,input_tokens=:input_tokens,
            output_tokens=:output_tokens,estimated_cost_usd=:estimated_cost_usd,updated_at=now()
            WHERE id=:id AND workspace_id=:workspace_id RETURNING *"""),
                    values,
                )
            )
            .mappings()
            .one()
        )
        return self._run(row)

    async def append_event(
        self, run: AgentRun, event_type: str, payload: dict[str, object]
    ) -> RunEvent:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_run_events
            (id,workspace_id,agent_run_id,sequence,event_type,payload)
            SELECT :id,:wid,:rid,COALESCE(MAX(sequence),0)+1,:event_type,CAST(:payload AS jsonb)
            FROM agent_run_events WHERE agent_run_id=:rid RETURNING *"""),
                    {
                        "id": uuid4(),
                        "wid": run.workspace_id,
                        "rid": run.id,
                        "event_type": event_type,
                        "payload": json.dumps(payload),
                    },
                )
            )
            .mappings()
            .one()
        )
        return RunEvent(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["agent_run_id"])),
            int(str(row["sequence"])),
            str(row["event_type"]),
            dict(cast(Mapping[str, object], row["payload"])),
            cast(datetime, row["created_at"]),
        )

    async def list_events(self, workspace_id: UUID, run_id: UUID) -> list[RunEvent]:
        rows = (
            await self.session.execute(
                text("""SELECT * FROM agent_run_events
            WHERE workspace_id=:wid AND agent_run_id=:rid ORDER BY sequence"""),
                {"wid": workspace_id, "rid": run_id},
            )
        ).mappings()
        return [
            RunEvent(
                UUID(str(row["id"])),
                workspace_id,
                run_id,
                int(str(row["sequence"])),
                str(row["event_type"]),
                dict(cast(Mapping[str, object], row["payload"])),
                cast(datetime, row["created_at"]),
            )
            for row in rows
        ]

    async def list_tool_calls(self, workspace_id: UUID, run_id: UUID) -> list[RunToolCall]:
        rows = (
            await self.session.execute(
                text("""SELECT * FROM agent_run_tool_calls
            WHERE workspace_id=:wid AND agent_run_id=:rid ORDER BY created_at,id LIMIT 1000"""),
                {"wid": workspace_id, "rid": run_id},
            )
        ).mappings()
        return [
            RunToolCall(
                UUID(str(row["id"])),
                workspace_id,
                run_id,
                str(row["tool_name"]),
                str(row["status"]),
                dict(cast(Mapping[str, object], row["request_payload"])),
                dict(cast(Mapping[str, object], row["response_payload"]))
                if row["response_payload"] is not None
                else None,
                str(row["error_message"]) if row["error_message"] else None,
                cast(datetime, row["created_at"]),
            )
            for row in rows
        ]

    async def list_artifacts(self, workspace_id: UUID, run_id: UUID) -> list[RunArtifact]:
        rows = (
            await self.session.execute(
                text("""SELECT * FROM agent_run_artifacts
            WHERE workspace_id=:wid AND agent_run_id=:rid ORDER BY created_at,id LIMIT 1000"""),
                {"wid": workspace_id, "rid": run_id},
            )
        ).mappings()
        return [
            RunArtifact(
                UUID(str(row["id"])),
                workspace_id,
                run_id,
                str(row["kind"]),
                str(row["storage_key"]) if row["storage_key"] else None,
                dict(cast(Mapping[str, object], row["artifact_metadata"])),
                cast(datetime, row["created_at"]),
            )
            for row in rows
        ]

    async def list_document_links(self, workspace_id: UUID, run_id: UUID) -> list[RunDocumentLink]:
        rows = (
            await self.session.execute(
                text("""SELECT l.*,d.title AS document_title
            FROM agent_document_links l JOIN documents d
              ON d.id=l.document_id AND d.workspace_id=l.workspace_id
            WHERE l.workspace_id=:wid AND l.agent_run_id=:rid AND d.deleted_at IS NULL
            ORDER BY l.created_at,l.id LIMIT 1000"""),
                {"wid": workspace_id, "rid": run_id},
            )
        ).mappings()
        return [
            RunDocumentLink(
                UUID(str(row["id"])),
                workspace_id,
                run_id,
                UUID(str(row["document_id"])),
                str(row["relation"]),
                str(row["document_title"]),
                cast(datetime, row["created_at"]),
            )
            for row in rows
        ]

    async def insert_tool_call(self, value: RunToolCall) -> RunToolCall:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_run_tool_calls
            (id,workspace_id,agent_run_id,tool_name,status,request_payload,response_payload,error_message)
            VALUES (:id,:wid,:rid,:tool,:status,CAST(:request AS jsonb),CAST(:response AS jsonb),:error)
            RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "rid": value.run_id,
                        "tool": value.tool_name,
                        "status": value.status,
                        "request": json.dumps(value.request_payload),
                        "response": json.dumps(value.response_payload)
                        if value.response_payload is not None
                        else None,
                        "error": value.error_message,
                    },
                )
            )
            .mappings()
            .one()
        )
        return RunToolCall(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["agent_run_id"])),
            str(row["tool_name"]),
            str(row["status"]),
            dict(cast(Mapping[str, object], row["request_payload"])),
            dict(cast(Mapping[str, object], row["response_payload"]))
            if row["response_payload"] is not None
            else None,
            str(row["error_message"]) if row["error_message"] else None,
            cast(datetime, row["created_at"]),
        )

    async def insert_artifact(self, value: RunArtifact) -> RunArtifact:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_run_artifacts
            (id,workspace_id,agent_run_id,kind,storage_key,artifact_metadata)
            VALUES (:id,:wid,:rid,:kind,:storage,CAST(:metadata AS jsonb)) RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "rid": value.run_id,
                        "kind": value.kind,
                        "storage": value.storage_key,
                        "metadata": json.dumps(value.metadata),
                    },
                )
            )
            .mappings()
            .one()
        )
        return RunArtifact(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["agent_run_id"])),
            str(row["kind"]),
            str(row["storage_key"]) if row["storage_key"] else None,
            dict(cast(Mapping[str, object], row["artifact_metadata"])),
            cast(datetime, row["created_at"]),
        )

    async def insert_document_link(self, value: RunDocumentLink) -> RunDocumentLink:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO agent_document_links
            (id,workspace_id,agent_run_id,document_id,relation)
            SELECT :id,:wid,:rid,d.id,:relation FROM documents d
            WHERE d.id=:document AND d.workspace_id=:wid AND d.deleted_at IS NULL
            ON CONFLICT (agent_run_id,document_id,relation) DO NOTHING RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "rid": value.run_id,
                        "document": value.document_id,
                        "relation": value.relation,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            existing = (
                (
                    await self.session.execute(
                        text("""SELECT l.*,d.title AS document_title FROM agent_document_links l
                JOIN documents d ON d.id=l.document_id AND d.workspace_id=l.workspace_id
                WHERE l.workspace_id=:wid AND l.agent_run_id=:rid
                AND l.document_id=:document AND l.relation=:relation"""),
                        {
                            "wid": value.workspace_id,
                            "rid": value.run_id,
                            "document": value.document_id,
                            "relation": value.relation,
                        },
                    )
                )
                .mappings()
                .one_or_none()
            )
            if existing is None:
                raise ValueError("Agent Document must exist in the run Workspace")
            row = existing
        title = await self.session.scalar(
            text("SELECT title FROM documents WHERE workspace_id=:wid AND id=:id"),
            {"wid": value.workspace_id, "id": value.document_id},
        )
        return RunDocumentLink(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["agent_run_id"])),
            UUID(str(row["document_id"])),
            str(row["relation"]),
            str(title),
            cast(datetime, row["created_at"]),
        )

    @staticmethod
    def _dataclass(
        value: AgentDefinition | AgentVersion | AgentRun,
    ) -> dict[str, object]:
        return cast(dict[str, object], asdict(value))

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
