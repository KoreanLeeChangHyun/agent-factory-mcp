from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from typing import cast
from uuid import UUID, uuid4

from agent_factory_core.connections.mcp.domain import MCPConnection, MCPConnectionState
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresMCPConnectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def workspace_available(self, organization_id: UUID, workspace_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text("""SELECT EXISTS(SELECT 1 FROM workspaces
            WHERE id=:wid AND organization_id=:oid AND status='active' AND deleted_at IS NULL)"""),
                {"wid": workspace_id, "oid": organization_id},
            )
        )

    async def create(
        self,
        *,
        connection_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        workspace_id: UUID,
        name: str,
        token_digest: bytes,
        scopes: tuple[str, ...],
        expires_at: datetime,
        encrypted_token: bytes,
        key_version: int,
    ) -> MCPConnection:
        token_id = uuid4()
        await self.session.execute(
            text("""INSERT INTO api_tokens
            (id,user_id,name,token_digest,scopes,expires_at) VALUES
            (:id,:uid,:name,:digest,CAST(:scopes AS jsonb),:expires)"""),
            {
                "id": token_id,
                "uid": user_id,
                "name": name,
                "digest": token_digest,
                "scopes": json.dumps(scopes),
                "expires": expires_at,
            },
        )
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO mcp_connections
            (id,user_id,organization_id,workspace_id,token_id,encrypted_token,encryption_key_version,name)
            VALUES (:id,:uid,:oid,:wid,:tid,:encrypted,:version,:name) RETURNING *"""),
                    {
                        "id": connection_id,
                        "uid": user_id,
                        "oid": organization_id,
                        "wid": workspace_id,
                        "tid": token_id,
                        "encrypted": encrypted_token,
                        "version": key_version,
                        "name": name,
                    },
                )
            )
            .mappings()
            .one()
        )
        return self._connection(row, expires_at=expires_at)

    async def list_owned(
        self, user_id: UUID, organization_id: UUID, workspace_id: UUID, now: datetime
    ) -> list[MCPConnection]:
        rows = (
            await self.session.execute(
                text("""SELECT c.*,t.expires_at,t.revoked_at
            FROM mcp_connections c JOIN api_tokens t ON t.id=c.token_id
            WHERE c.user_id=:uid AND c.organization_id=:oid AND c.workspace_id=:wid
            ORDER BY c.created_at DESC,c.id"""),
                {"uid": user_id, "oid": organization_id, "wid": workspace_id},
            )
        ).mappings()
        return [self._connection(row, now=now) for row in rows]

    async def encrypted_secret(
        self,
        connection_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        workspace_id: UUID,
        now: datetime,
    ):
        row = (
            (
                await self.session.execute(
                    text("""SELECT c.*,t.expires_at,t.revoked_at,t.token_digest
            FROM mcp_connections c JOIN api_tokens t ON t.id=c.token_id AND t.user_id=c.user_id
            WHERE c.id=:id AND c.user_id=:uid AND c.organization_id=:oid AND c.workspace_id=:wid"""),
                    {
                        "id": connection_id,
                        "uid": user_id,
                        "oid": organization_id,
                        "wid": workspace_id,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None or row["encrypted_token"] is None or row["encryption_key_version"] is None:
            return (
                None
                if row is None
                else (self._connection(row, now=now), b"", 0, bytes(row["token_digest"]))
            )
        return (
            self._connection(row, now=now),
            bytes(row["encrypted_token"]),
            int(row["encryption_key_version"]),
            bytes(row["token_digest"]),
        )

    async def revoke(
        self,
        connection_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        workspace_id: UUID,
        now: datetime,
    ) -> bool:
        row = await self.session.scalar(
            text("""UPDATE mcp_connections c SET encrypted_token=NULL,
            encryption_key_version=NULL,updated_at=:now FROM api_tokens t WHERE c.id=:id
            AND c.user_id=:uid AND c.organization_id=:oid AND c.workspace_id=:wid
            AND t.id=c.token_id AND t.user_id=:uid RETURNING c.token_id"""),
            {
                "now": now,
                "id": connection_id,
                "uid": user_id,
                "oid": organization_id,
                "wid": workspace_id,
            },
        )
        if row is None:
            return False
        await self.session.execute(
            text("UPDATE api_tokens SET revoked_at=:now WHERE id=:id AND user_id=:uid"),
            {"now": now, "id": row, "uid": user_id},
        )
        return True

    async def purge(
        self, connection_id: UUID, user_id: UUID, organization_id: UUID, workspace_id: UUID
    ) -> str:
        row = (
            (
                await self.session.execute(
                    text("""SELECT c.token_id,t.revoked_at FROM mcp_connections c
            JOIN api_tokens t ON t.id=c.token_id AND t.user_id=c.user_id WHERE c.id=:id AND c.user_id=:uid
            AND c.organization_id=:oid AND c.workspace_id=:wid FOR UPDATE OF c,t"""),
                    {
                        "id": connection_id,
                        "uid": user_id,
                        "oid": organization_id,
                        "wid": workspace_id,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return "missing"
        if row["revoked_at"] is None:
            return "active"
        await self.session.execute(
            text("DELETE FROM mcp_connections WHERE id=:id"), {"id": connection_id}
        )
        await self.session.execute(
            text("DELETE FROM api_tokens WHERE id=:id AND user_id=:uid"),
            {"id": row["token_id"], "uid": user_id},
        )
        return "deleted"

    @staticmethod
    def _connection(
        row: Mapping[str, object],
        *,
        expires_at: datetime | None = None,
        now: datetime | None = None,
    ) -> MCPConnection:
        expires = expires_at or cast(datetime | None, row.get("expires_at"))
        revoked = row.get("revoked_at")
        reason = "revoked" if revoked else "expired" if now and expires and expires <= now else None
        state = (
            MCPConnectionState.REAUTH_REQUIRED
            if reason
            else (
                MCPConnectionState.VERIFIED
                if row.get("first_confirmed_at")
                else MCPConnectionState.PENDING
            )
        )
        return MCPConnection(
            UUID(str(row["id"])),
            UUID(str(row["user_id"])),
            UUID(str(row["organization_id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["token_id"])),
            str(row["name"]),
            state,
            bool(row.get("encrypted_token")) and reason is None,
            expires,
            str(row["client_name"]) if row.get("client_name") else None,
            cast(datetime | None, row.get("first_confirmed_at")),
            cast(datetime | None, row.get("last_seen_at")),
            reason,
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
