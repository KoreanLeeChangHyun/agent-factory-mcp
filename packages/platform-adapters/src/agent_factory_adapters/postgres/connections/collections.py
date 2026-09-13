from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from datetime import datetime
from threading import Lock
from typing import cast
from uuid import UUID

from agent_factory_core.connections.providers.collection_domain import (
    CollectionMode,
    CollectionResult,
    CollectionRun,
    CollectionRunStatus,
    CollectionSelection,
    ProviderCollection,
    ProviderInspection,
)
from agent_factory_core.connections.providers.credentials import CredentialConnection
from agent_factory_core.connections.providers.domain import ConnectionStatus
from agent_factory_core.shared.errors import ConflictError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

_PROCESS_CONNECTION_GUARDS: set[tuple[UUID, UUID]] = set()
_PROCESS_CONNECTION_GUARDS_LOCK = Lock()


class PostgresCollectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @asynccontextmanager
    async def guard(self, workspace_id: UUID, connection_id: UUID) -> AsyncIterator[None]:
        identity = (workspace_id, connection_id)
        with _PROCESS_CONNECTION_GUARDS_LOCK:
            if identity in _PROCESS_CONNECTION_GUARDS:
                raise ConflictError("integration_busy", "Connection has an operation in progress")
            _PROCESS_CONNECTION_GUARDS.add(identity)
        key = int.from_bytes(
            hashlib.sha256(f"{workspace_id}:{connection_id}".encode()).digest()[:8],
            "big",
            signed=True,
        )
        try:
            bind = cast(AsyncEngine | None, self.session.bind)
            if bind is None:
                raise RuntimeError("Collection guard requires a bound PostgreSQL session")
            async with bind.connect() as connection, connection.begin():
                if not await connection.scalar(
                    text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key}
                ):
                    raise ConflictError(
                        "integration_busy", "Connection has an operation in progress"
                    )
                yield
        finally:
            with _PROCESS_CONNECTION_GUARDS_LOCK:
                _PROCESS_CONNECTION_GUARDS.discard(identity)

    async def connection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> CredentialConnection | None:
        row = (
            (
                await self.session.execute(
                    text("""SELECT c.*,p.key AS provider FROM integration_connections c
            JOIN integration_providers p ON p.id=c.provider_id
            WHERE c.workspace_id=:wid AND c.id=:id AND c.deleted_at IS NULL"""),
                    {"wid": workspace_id, "id": connection_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        return CredentialConnection(
            UUID(str(row["id"])),
            workspace_id,
            UUID(str(row["provider_id"])),
            str(row["provider"]),
            ConnectionStatus(str(row["status"])),
            bytes(row["encrypted_credentials"]) if row["encrypted_credentials"] else None,
            int(str(row["encryption_key_version"])) if row["encryption_key_version"] else None,
        )

    @staticmethod
    def _selection(row: Mapping[str, object]) -> CollectionSelection:
        raw = dict(cast(Mapping[str, object], row["selection"]))
        return CollectionSelection(
            {
                key: value
                for key, value in raw.items()
                if key not in {"max_items", "max_pages", "max_bytes", "attachments"}
            },
            int(str(raw.get("max_items", 100))),
            int(str(raw.get("max_pages", 100))),
            int(str(raw.get("max_bytes", 50_000_000))),
            bool(raw.get("attachments", True)),
        )

    @classmethod
    def _collection(cls, row: Mapping[str, object]) -> ProviderCollection:
        return ProviderCollection(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["connection_id"])),
            str(row["provider"]),
            str(row["name"]),
            cls._selection(row),
            CollectionMode(str(row["mode"])),
            UUID(str(row["created_by_user_id"])),
            bool(row["is_enabled"]),
            CollectionRunStatus(str(row["last_refresh_status"]))
            if row["last_refresh_status"]
            else None,
            cast(datetime | None, row["last_refreshed_at"]),
            str(row["last_error_code"]) if row["last_error_code"] else None,
        )

    @staticmethod
    def _result(value: Mapping[str, object]) -> CollectionResult:
        return CollectionResult(
            str(value["source_id"]),
            UUID(str(value["document_id"])),
            int(str(value["revision_number"]))
            if value.get("revision_number") is not None
            else None,
            str(value["sha256"]) if value.get("sha256") else None,
            bool(value.get("changed")),
            str(value["source_url"]) if value.get("source_url") else None,
            bool(value.get("body_stored", True)),
            tuple(str(item) for item in cast(list[object], value.get("limitations", []))),
        )

    @classmethod
    def _run(cls, row: Mapping[str, object]) -> CollectionRun:
        return CollectionRun(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["collection_id"])),
            UUID(str(row["requested_by_user_id"])),
            str(row["request_key"]),
            CollectionRunStatus(str(row["status"])),
            UUID(str(row["job_id"])) if row["job_id"] else None,
            dict(cast(Mapping[str, object], row["cursor"])),
            tuple(
                cls._result(cast(Mapping[str, object], item))
                for item in cast(list[object], row["results"])
            ),
            int(str(row["examined"])),
            int(str(row["pages"])),
            int(str(row["bytes_read"])),
            bool(row["cancel_requested"]),
            str(row["error_code"]) if row["error_code"] else None,
            cast(datetime | None, row["finished_at"]),
        )

    @staticmethod
    def _selection_json(value: CollectionSelection) -> str:
        return json.dumps(
            {
                **value.values,
                "max_items": value.max_items,
                "max_pages": value.max_pages,
                "max_bytes": value.max_bytes,
                "attachments": value.attachments,
            }
        )

    async def insert_collection(self, value: ProviderCollection) -> ProviderCollection:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO integration_collections
            (id,workspace_id,connection_id,provider,name,selection,mode,is_enabled,created_by_user_id)
            VALUES (:id,:wid,:connection,:provider,:name,CAST(:selection AS jsonb),:mode,:enabled,:user)
            RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "connection": value.connection_id,
                        "provider": value.provider,
                        "name": value.name,
                        "selection": self._selection_json(value.selection),
                        "mode": value.mode.value,
                        "enabled": value.enabled,
                        "user": value.created_by_user_id,
                    },
                )
            )
            .mappings()
            .one()
        )
        return self._collection(row)

    async def collections(self, workspace_id: UUID) -> list[ProviderCollection]:
        rows = (
            await self.session.execute(
                text("""SELECT * FROM integration_collections WHERE workspace_id=:wid
            ORDER BY created_at,id LIMIT 1000"""),
                {"wid": workspace_id},
            )
        ).mappings()
        return [self._collection(row) for row in rows]

    async def collection(
        self, workspace_id: UUID, collection_id: UUID
    ) -> ProviderCollection | None:
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM integration_collections WHERE workspace_id=:wid AND id=:id"
                    ),
                    {"wid": workspace_id, "id": collection_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._collection(row) if row else None

    async def set_enabled(self, value: ProviderCollection) -> ProviderCollection:
        row = (
            (
                await self.session.execute(
                    text("""UPDATE integration_collections SET is_enabled=:enabled,updated_at=now()
            WHERE workspace_id=:wid AND id=:id RETURNING *"""),
                    {"enabled": value.enabled, "wid": value.workspace_id, "id": value.id},
                )
            )
            .mappings()
            .one()
        )
        return self._collection(row)

    async def find_run(
        self, workspace_id: UUID, collection_id: UUID, key: str
    ) -> CollectionRun | None:
        row = (
            (
                await self.session.execute(
                    text("""SELECT * FROM integration_collection_runs
            WHERE workspace_id=:wid AND collection_id=:collection AND request_key=:key"""),
                    {"wid": workspace_id, "collection": collection_id, "key": key},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._run(row) if row else None

    async def insert_run(self, value: CollectionRun) -> CollectionRun:
        await self.session.execute(
            text("""INSERT INTO integration_collection_runs
            (id,workspace_id,collection_id,requested_by_user_id,request_key,status,cursor,results,
             examined,pages,bytes_read,cancel_requested)
            VALUES (:id,:wid,:collection,:user,:key,:status,CAST(:cursor AS jsonb),
                    CAST(:results AS jsonb),:examined,:pages,:bytes,:cancel)"""),
            {
                "id": value.id,
                "wid": value.workspace_id,
                "collection": value.collection_id,
                "user": value.requested_by_user_id,
                "key": value.request_key,
                "status": value.status.value,
                "cursor": json.dumps(value.cursor),
                "results": json.dumps([]),
                "examined": value.examined,
                "pages": value.pages,
                "bytes": value.bytes_read,
                "cancel": value.cancel_requested,
            },
        )
        return value

    async def run(
        self, workspace_id: UUID, run_id: UUID, *, lock: bool = False
    ) -> CollectionRun | None:
        suffix = " FOR UPDATE" if lock else ""
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM integration_collection_runs WHERE workspace_id=:wid AND id=:id"
                        + suffix
                    ),
                    {"wid": workspace_id, "id": run_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._run(row) if row else None

    async def save_run(self, value: CollectionRun) -> CollectionRun:
        await self.session.execute(
            text("""UPDATE integration_collection_runs SET job_id=:job,status=:status,
            cursor=CAST(:cursor AS jsonb),results=CAST(:results AS jsonb),examined=:examined,
            pages=:pages,bytes_read=:bytes,cancel_requested=:cancel,error_code=:error,
            finished_at=:finished,updated_at=now() WHERE workspace_id=:wid AND id=:id"""),
            {
                "job": value.job_id,
                "status": value.status.value,
                "cursor": json.dumps(value.cursor),
                "results": json.dumps(
                    [
                        {
                            "source_id": result.source_id,
                            "document_id": str(result.document_id),
                            "revision_number": result.revision_number,
                            "sha256": result.sha256,
                            "changed": result.changed,
                            "source_url": result.source_url,
                            "body_stored": result.body_stored,
                            "limitations": list(result.limitations),
                        }
                        for result in value.results
                    ]
                ),
                "examined": value.examined,
                "pages": value.pages,
                "bytes": value.bytes_read,
                "cancel": value.cancel_requested,
                "error": value.error_code,
                "finished": value.finished_at,
                "wid": value.workspace_id,
                "id": value.id,
            },
        )
        return value

    async def save_collection(self, value: ProviderCollection) -> None:
        await self.session.execute(
            text("""UPDATE integration_collections SET last_refresh_status=:status,
            last_refreshed_at=:refreshed,last_error_code=:error,updated_at=now()
            WHERE workspace_id=:wid AND id=:id"""),
            {
                "status": value.last_refresh_status.value if value.last_refresh_status else None,
                "refreshed": value.last_refreshed_at,
                "error": value.last_error_code,
                "wid": value.workspace_id,
                "id": value.id,
            },
        )

    async def inspection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> ProviderInspection | None:
        row = (
            (
                await self.session.execute(
                    text("""SELECT * FROM integration_cloud_connection_states
            WHERE workspace_id=:wid AND connection_id=:id"""),
                    {"wid": workspace_id, "id": connection_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None or row["inspected_at"] is None:
            return None
        observed = cast(Mapping[str, object], row["inspection"])
        granted = cast(list[object] | None, row["granted_scopes"])
        return ProviderInspection(
            workspace_id,
            connection_id,
            str(observed.get("health", "unknown")),
            str(observed["account_id"]) if observed.get("account_id") else None,
            tuple(str(item) for item in cast(list[object], row["requested_scopes"])),
            tuple(str(item) for item in granted) if granted is not None else None,
            str(observed.get("scope_support", "supported")),
            cast(datetime, row["inspected_at"]),
            False,
            str(observed["error_code"]) if observed.get("error_code") else None,
        )

    async def save_inspection(self, value: ProviderInspection) -> None:
        payload = {
            "health": value.health,
            "account_id": value.account_id,
            "scope_support": value.scope_support,
            "error_code": value.error_code,
        }
        await self.session.execute(
            text("""INSERT INTO integration_cloud_connection_states
            (id,workspace_id,connection_id,requested_scopes,granted_scopes,inspection,inspected_at)
            VALUES (gen_random_uuid(),:wid,:connection,CAST(:requested AS jsonb),
            CAST(:granted AS jsonb),CAST(:inspection AS jsonb),:observed)
            ON CONFLICT (workspace_id,connection_id) DO UPDATE SET
            granted_scopes=EXCLUDED.granted_scopes,inspection=EXCLUDED.inspection,
            inspected_at=EXCLUDED.inspected_at,updated_at=now()"""),
            {
                "wid": value.workspace_id,
                "connection": value.connection_id,
                "requested": json.dumps(value.requested_scopes),
                "granted": json.dumps(value.granted_scopes)
                if value.granted_scopes is not None
                else None,
                "inspection": json.dumps(payload),
                "observed": value.observed_at,
            },
        )

    async def cancelled(self, workspace_id: UUID, run_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text("""SELECT cancel_requested FROM integration_collection_runs
            WHERE workspace_id=:wid AND id=:id"""),
                {"wid": workspace_id, "id": run_id},
            )
        )

    async def mark_reference_states(
        self, collection: ProviderCollection, seen: frozenset[str], status: str
    ) -> None:
        await self.session.execute(
            text("""UPDATE integration_source_mappings SET source_status=:status,updated_at=now()
            WHERE workspace_id=:wid AND collection_id=:collection
            AND NOT (source_id = ANY(:seen)) AND source_status='active'"""),
            {
                "status": status,
                "wid": collection.workspace_id,
                "collection": collection.id,
                "seen": list(seen),
            },
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
