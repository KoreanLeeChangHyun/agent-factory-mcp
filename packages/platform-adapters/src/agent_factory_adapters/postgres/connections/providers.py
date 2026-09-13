from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from datetime import datetime
from typing import cast
from uuid import UUID

from agent_factory_core.connections.providers.domain import (
    ConnectionStatus,
    Provider,
    ProviderAuthType,
    ProviderConnection,
)
from agent_factory_core.shared.errors import ConflictError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


class PostgresProviderConnectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @asynccontextmanager
    async def guard(self, workspace_id: UUID, connection_id: UUID) -> AsyncIterator[None]:
        key = int.from_bytes(
            hashlib.sha256(f"{workspace_id}:{connection_id}".encode()).digest()[:8],
            "big",
            signed=True,
        )
        bind = cast(AsyncEngine | None, self.session.bind)
        if bind is None:
            raise RuntimeError("Provider connection guard requires a bound PostgreSQL session")
        async with bind.connect() as connection, connection.begin():
            acquired = await connection.scalar(
                text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key}
            )
            if not acquired:
                raise ConflictError("integration_busy", "Connection has an operation in progress")
            yield

    @staticmethod
    def _provider(row: Mapping[str, object]) -> Provider:
        return Provider(
            UUID(str(row["id"])),
            str(row["key"]),
            str(row["display_name"]),
            ProviderAuthType(str(row["auth_type"])),
            tuple(str(value) for value in cast(list[object], row["capabilities"])),
            dict(cast(Mapping[str, object], row["configuration_schema"])),
            bool(row["is_enabled"]),
        )

    @staticmethod
    def _connection(row: Mapping[str, object]) -> ProviderConnection:
        return ProviderConnection(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["provider_id"])),
            str(row["name"]),
            ConnectionStatus(str(row["status"])),
            int(str(row["revision"])),
            str(row["external_account_id"]) if row["external_account_id"] else None,
            cast(datetime | None, row["last_synced_at"]),
            str(row["last_error_code"]) if row["last_error_code"] else None,
            bool(row["encrypted_credentials"]),
        )

    async def lock_workspace(self, organization_id: UUID, workspace_id: UUID) -> bool:
        row = await self.session.scalar(
            text("""SELECT id FROM workspaces WHERE id=:wid
            AND organization_id=:oid AND status='active' AND deleted_at IS NULL FOR UPDATE"""),
            {"wid": workspace_id, "oid": organization_id},
        )
        return row is not None

    async def providers(self) -> list[Provider]:
        rows = (
            await self.session.execute(
                text("SELECT * FROM integration_providers ORDER BY display_name,id")
            )
        ).mappings()
        return [self._provider(row) for row in rows]

    async def provider(self, provider_id: UUID) -> Provider | None:
        row = (
            (
                await self.session.execute(
                    text("SELECT * FROM integration_providers WHERE id=:id"), {"id": provider_id}
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._provider(row) if row else None

    async def connections(self, workspace_id: UUID) -> list[ProviderConnection]:
        rows = (
            await self.session.execute(
                text("""SELECT * FROM integration_connections
            WHERE workspace_id=:wid AND deleted_at IS NULL ORDER BY created_at DESC,id"""),
                {"wid": workspace_id},
            )
        ).mappings()
        return [self._connection(row) for row in rows]

    async def insert_connection(
        self,
        value: ProviderConnection,
        encrypted_credentials: bytes | None,
        key_version: int | None,
    ) -> ProviderConnection:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO integration_connections
            (id,workspace_id,provider_id,name,status,revision,encrypted_credentials,encryption_key_version,sync_cursor)
            VALUES (:id,:wid,:pid,:name,:status,:revision,:credentials,:key_version,CAST(:cursor AS jsonb))
            RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "pid": value.provider_id,
                        "name": value.name,
                        "status": value.status.value,
                        "revision": value.revision,
                        "credentials": encrypted_credentials,
                        "key_version": key_version,
                        "cursor": json.dumps({}),
                    },
                )
            )
            .mappings()
            .one()
        )
        return self._connection(row)

    async def disconnect(
        self, workspace_id: UUID, connection_id: UUID
    ) -> ProviderConnection | None:
        row = (
            (
                await self.session.execute(
                    text("""UPDATE integration_connections SET
            status='disconnected',encrypted_credentials=NULL,encryption_key_version=NULL,
            revision=revision+1,updated_at=now() WHERE id=:id AND workspace_id=:wid
            AND deleted_at IS NULL RETURNING *"""),
                    {"id": connection_id, "wid": workspace_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._connection(row) if row else None

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
