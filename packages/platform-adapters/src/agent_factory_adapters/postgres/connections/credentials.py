from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import cast
from uuid import UUID, uuid4

from agent_factory_core.connections.providers.credentials import (
    CredentialConnection,
    OAuthState,
    ResolvedOAuthState,
)
from agent_factory_core.connections.providers.domain import ConnectionStatus
from agent_factory_core.shared.errors import ConflictError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


class PostgresProviderCredentialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def connection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> CredentialConnection | None:
        row = (
            (
                await self.session.execute(
                    text("""SELECT c.id,c.workspace_id,c.provider_id,
            p.key AS provider,c.status,c.encrypted_credentials,c.encryption_key_version
            FROM integration_connections c JOIN integration_providers p ON p.id=c.provider_id
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

    @asynccontextmanager
    async def guard(self, workspace_id: UUID, connection_id: UUID) -> AsyncIterator[None]:
        key = int.from_bytes(
            hashlib.sha256(f"{workspace_id}:{connection_id}".encode()).digest()[:8],
            "big",
            signed=True,
        )
        bind = cast(AsyncEngine | None, self.session.bind)
        if bind is None:
            raise RuntimeError("Provider credential guard requires a bound PostgreSQL session")
        async with bind.connect() as connection, connection.begin():
            acquired = await connection.scalar(
                text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key}
            )
            if not acquired:
                raise ConflictError("integration_busy", "Connection has an operation in progress")
            yield

    async def save_oauth_state(self, state: OAuthState) -> None:
        await self.session.execute(
            text("""INSERT INTO integration_oauth_states
            (id,workspace_id,provider_id,user_id,state_digest,encrypted_pkce_verifier,expires_at)
            VALUES (:id,:wid,:provider,:user,:digest,:context,:expires)"""),
            {
                "id": uuid4(),
                "wid": state.workspace_id,
                "provider": state.provider_id,
                "user": state.user_id,
                "digest": state.state_digest,
                "context": state.encrypted_context,
                "expires": state.expires_at,
            },
        )

    async def resolve_oauth_state(
        self, provider: str, user_id: UUID, digest: bytes, now: datetime
    ) -> ResolvedOAuthState | None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        try:
            row = (
                (
                    await self.session.execute(
                        text("""SELECT s.*,w.organization_id,p.key AS provider
                FROM integration_oauth_states s
                JOIN workspaces w ON w.id=s.workspace_id
                JOIN integration_providers p ON p.id=s.provider_id
                WHERE s.user_id=:uid AND s.state_digest=:digest AND p.key=:provider
                AND s.consumed_at IS NULL AND s.expires_at>:now
                AND w.status='active' AND w.deleted_at IS NULL"""),
                        {"uid": user_id, "digest": digest, "provider": provider, "now": now},
                    )
                )
                .mappings()
                .one_or_none()
            )
        finally:
            # Remove temporary identity-lookup authority before tenant authorization.
            await self.session.rollback()
        if row is None:
            return None
        return ResolvedOAuthState(
            UUID(str(row["organization_id"])),
            str(row["provider"]),
            OAuthState(
                UUID(str(row["workspace_id"])),
                UUID(str(row["provider_id"])),
                user_id,
                bytes(row["state_digest"]),
                bytes(row["encrypted_pkce_verifier"]),
                cast(datetime, row["expires_at"]),
            ),
        )

    async def consume_oauth_state(
        self,
        organization_id: UUID,
        workspace_id: UUID,
        user_id: UUID,
        digest: bytes,
        now: datetime,
    ) -> OAuthState | None:
        row = (
            (
                await self.session.execute(
                    text("""UPDATE integration_oauth_states
            SET consumed_at=:now WHERE workspace_id=:wid AND user_id=:uid
            AND state_digest=:digest AND consumed_at IS NULL AND expires_at>:now RETURNING *"""),
                    {"now": now, "wid": workspace_id, "uid": user_id, "digest": digest},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        result = OAuthState(
            workspace_id,
            UUID(str(row["provider_id"])),
            user_id,
            bytes(row["state_digest"]),
            bytes(row["encrypted_pkce_verifier"]),
            cast(datetime, row["expires_at"]),
        )
        # Consumption is durable before the external token exchange so a failed
        # callback cannot make a single-use state replayable.
        await self.session.commit()
        await self.session.execute(
            text(
                "SELECT set_config('app.current_organization_id', :oid, true), "
                "set_config('app.current_workspace_id', :wid, true), "
                "set_config('app.current_user_id', :uid, true), "
                "set_config('app.is_platform_admin', 'false', true)"
            ),
            {"oid": str(organization_id), "wid": str(workspace_id), "uid": str(user_id)},
        )
        return result

    async def save_oauth_failure(
        self, connection: CredentialConnection, *, error_code: str
    ) -> None:
        await self.session.execute(
            text("""UPDATE integration_connections SET
            last_error_code=:error_code,last_error_message=NULL,
            revision=revision+1,updated_at=now()
            WHERE id=:id AND workspace_id=:wid"""),
            {
                "error_code": error_code,
                "id": connection.id,
                "wid": connection.workspace_id,
            },
        )

    async def save_credentials(
        self,
        connection: CredentialConnection,
        *,
        encrypted_credentials: bytes,
        key_version: int,
        requested_scopes: tuple[str, ...],
        granted_scopes: tuple[str, ...] | None,
        status: ConnectionStatus,
    ) -> None:
        await self.session.execute(
            text("""UPDATE integration_connections SET
            encrypted_credentials=:credentials,encryption_key_version=:version,status=:status,
            external_account_id=NULL,last_error_code=NULL,last_error_message=NULL,
            revision=revision+1,updated_at=now() WHERE id=:id AND workspace_id=:wid"""),
            {
                "credentials": encrypted_credentials,
                "version": key_version,
                "status": status.value,
                "id": connection.id,
                "wid": connection.workspace_id,
            },
        )
        await self.session.execute(
            text("""INSERT INTO integration_cloud_connection_states
            (id,workspace_id,connection_id,requested_scopes,granted_scopes,inspection)
            VALUES (:state_id,:wid,:id,CAST(:requested AS jsonb),CAST(:granted AS jsonb),'{}'::jsonb)
            ON CONFLICT (workspace_id,connection_id) DO UPDATE SET
            requested_scopes=EXCLUDED.requested_scopes,granted_scopes=EXCLUDED.granted_scopes,
            inspection='{}'::jsonb,inspected_at=NULL,updated_at=now()"""),
            {
                "state_id": uuid4(),
                "wid": connection.workspace_id,
                "id": connection.id,
                "requested": json.dumps(requested_scopes),
                "granted": json.dumps(granted_scopes) if granted_scopes is not None else None,
            },
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
