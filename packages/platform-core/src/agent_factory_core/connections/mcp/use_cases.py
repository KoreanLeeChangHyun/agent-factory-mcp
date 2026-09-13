from __future__ import annotations

import hmac
from datetime import timedelta
from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.organizations.permissions import WORKSPACE_PERMISSIONS
from agent_factory_core.shared.errors import (
    ApplicationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

from .domain import IssuedMCPConnection, MCPConnection
from .ports import Clock, MCPConnectionRepository, TokenSecrets


class MCPConnectionUseCases:
    def __init__(
        self, repository: MCPConnectionRepository, secrets: TokenSecrets, clock: Clock
    ) -> None:
        self.repository = repository
        self.secrets = secrets
        self.clock = clock

    async def issue(self, context: AuthorizedContext, name: str) -> IssuedMCPConnection:
        require_context(context, "token.create")
        workspace_id = await self._workspace(context)
        cleaned = name.strip()
        if not cleaned or len(cleaned) > 120:
            raise ApplicationError("invalid_connection_name", "Token name is required", 422)
        connection_id, plaintext = uuid4(), f"afm_{self.secrets.issue()}"
        scopes = tuple(
            sorted(
                permission.replace(".", ":")
                for permission in context.permissions & WORKSPACE_PERMISSIONS
            )
        )
        encrypted = self.secrets.encrypt(
            {"purpose": "mcp-token", "connection_id": str(connection_id), "token": plaintext}
        )
        record = await self.repository.create(
            connection_id=connection_id,
            user_id=context.principal.user_id,
            organization_id=context.scope.organization_id,
            workspace_id=workspace_id,
            name=cleaned,
            token_digest=self.secrets.digest(plaintext),
            scopes=scopes,
            expires_at=self.clock.now() + timedelta(days=90),
            encrypted_token=encrypted,
            key_version=self.secrets.key_version,
        )
        await self.repository.commit()
        return IssuedMCPConnection(record, plaintext)

    async def status(self, context: AuthorizedContext) -> list[MCPConnection]:
        require_context(context, "token.read")
        workspace_id = await self._workspace(context)
        return await self.repository.list_owned(
            context.principal.user_id, context.scope.organization_id, workspace_id, self.clock.now()
        )

    async def reveal(self, context: AuthorizedContext, connection_id: UUID) -> str:
        require_context(context, "token.read")
        workspace_id = await self._workspace(context)
        row = await self.repository.encrypted_secret(
            connection_id,
            context.principal.user_id,
            context.scope.organization_id,
            workspace_id,
            self.clock.now(),
        )
        if row is None:
            raise NotFoundError("connection_not_found", "Connection not found")
        connection, ciphertext, key_version, expected_digest = row
        if not connection.retrievable:
            raise ConflictError("token_unavailable", "Expired, revoked, or legacy token")
        if key_version != self.secrets.key_version:
            raise ConflictError("token_key_unavailable", "Token encryption key is unavailable")
        try:
            value = self.secrets.decrypt(ciphertext, key_version)
            plaintext = value["token"]
            valid = (
                value.get("purpose") == "mcp-token"
                and value.get("connection_id") == str(connection.id)
                and isinstance(plaintext, str)
                and hmac.compare_digest(self.secrets.digest(plaintext), expected_digest)
            )
        except Exception as error:
            raise ConflictError(
                "token_decryption_failed", "Token could not be retrieved"
            ) from error
        if not valid:
            raise ConflictError("token_decryption_failed", "Token could not be retrieved")
        return plaintext

    async def revoke(self, context: AuthorizedContext, connection_id: UUID) -> None:
        require_context(context, "token.revoke")
        workspace_id = await self._workspace(context)
        if not await self.repository.revoke(
            connection_id,
            context.principal.user_id,
            context.scope.organization_id,
            workspace_id,
            self.clock.now(),
        ):
            raise NotFoundError("connection_not_found", "Connection not found")
        await self.repository.commit()

    async def purge(self, context: AuthorizedContext, connection_id: UUID) -> None:
        require_context(context, "token.revoke")
        workspace_id = await self._workspace(context)
        outcome = await self.repository.purge(
            connection_id, context.principal.user_id, context.scope.organization_id, workspace_id
        )
        if outcome == "missing":
            raise NotFoundError("connection_not_found", "Connection not found")
        if outcome == "active":
            raise ConflictError("token_not_revoked", "Revoke the token before deleting it")
        await self.repository.commit()

    async def _workspace(self, context: AuthorizedContext) -> UUID:
        workspace_id = require_workspace_id(context)
        if not await self.repository.workspace_available(
            context.scope.organization_id, workspace_id
        ):
            raise PermissionDeniedError("workspace_unavailable", "Workspace is unavailable")
        return workspace_id
