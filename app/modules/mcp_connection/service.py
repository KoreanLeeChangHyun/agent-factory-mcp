"""Enroll a credential without confusing enrollment with successful MCP use."""

from datetime import UTC, datetime, timedelta
from hmac import compare_digest
from uuid import UUID, uuid4

from cryptography.exceptions import InvalidTag
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ConflictError, NotFoundError, PermissionDeniedError
from app.core.config import settings
from app.infrastructure.secret_encryption import SecretCipher
from app.modules.auth.authorization import AuthorizedContext, require_context
from app.modules.organization.permissions import WORKSPACE_PERMISSIONS
from app.modules.auth.crypto import new_opaque_token, token_digest
from app.modules.auth.models import ApiToken
from app.modules.mcp_connection.models import MCPConnection
from app.modules.workspace.models import Workspace, WorkspaceStatus

READ_SCOPES = [
    "workspace:read",
    "document:read",
    "agent:read",
    "schedule:read",
    "integration:read",
    "logs:read",
    "tests:read",
]


class ConnectionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _ensure_available(self, context: AuthorizedContext):
        active = await self.session.scalar(
            select(Workspace.id).where(
                Workspace.id == context.scope.workspace_id,
                Workspace.status == WorkspaceStatus.ACTIVE,
            )
        )
        if active is None:
            raise PermissionDeniedError("workspace_unavailable", "Workspace is unavailable")

    async def create(self, context: AuthorizedContext, name: str):
        await self._ensure_available(context)
        plaintext = f"afm_{new_opaque_token()}"
        require_context(context, "token.create")
        scopes = sorted(key.replace(".", ":") for key in context.permissions & WORKSPACE_PERMISSIONS)
        token = ApiToken(
            user_id=context.principal.user_id,
            name=name,
            token_digest=token_digest(plaintext, settings.auth_token_secret.get_secret_value()),
            scopes=scopes,
            expires_at=datetime.now(UTC) + timedelta(days=90),
        )
        self.session.add(token)
        await self.session.flush()
        connection_id = uuid4()
        cipher = SecretCipher(
            settings.integration_encryption_key.get_secret_value(),
            settings.integration_encryption_key_version,
        )
        connection = MCPConnection(
            id=connection_id,
            encrypted_token=cipher.encrypt(
                {"purpose": "mcp-token", "connection_id": str(connection_id), "token": plaintext}
            ),
            encryption_key_version=cipher.key_version,
            user_id=context.principal.user_id,
            organization_id=context.scope.organization_id,
            workspace_id=context.scope.workspace_id,
            token_id=token.id,
            name=name,
        )
        self.session.add(connection)
        await self.session.commit()
        return connection, token, plaintext

    async def status(self, context: AuthorizedContext):
        require_context(context, "token.read")
        await self._ensure_available(context)
        rows = (
            await self.session.execute(
                select(MCPConnection, ApiToken)
                .join(ApiToken, ApiToken.id == MCPConnection.token_id)
                .where(
                    MCPConnection.user_id == context.principal.user_id,
                    MCPConnection.workspace_id == context.scope.workspace_id,
                    MCPConnection.organization_id == context.scope.organization_id,
                )
                .order_by(MCPConnection.created_at.desc())
            )
        ).all()
        now = datetime.now(UTC)
        items = []
        for connection, token in rows:
            reason = (
                "revoked"
                if token.revoked_at
                else "expired"
                if token.expires_at and token.expires_at <= now
                else None
            )
            items.append(
                {
                    "id": connection.id,
                    "name": connection.name,
                    "client_name": connection.client_name,
                    "state": "reauth_required"
                    if reason
                    else "verified"
                    if connection.first_confirmed_at
                    else "pending",
                    "reason": reason,
                    "first_confirmed_at": connection.first_confirmed_at,
                    "last_seen_at": connection.last_seen_at,
                    "expires_at": token.expires_at,
                    "retrievable": bool(connection.encrypted_token) and reason is None,
                }
            )
        state = (
            "verified"
            if any(row["state"] == "verified" for row in items)
            else "pending"
            if not items or any(row["state"] == "pending" for row in items)
            else "reauth_required"
        )
        return {"state": state, "connections": items}

    async def reveal(self, context: AuthorizedContext, connection_id: UUID):
        require_context(context, "token.read")
        await self._ensure_available(context)
        row = (
            await self.session.execute(
                select(MCPConnection, ApiToken)
                .join(ApiToken, ApiToken.id == MCPConnection.token_id)
                .where(
                    MCPConnection.id == connection_id,
                    MCPConnection.user_id == context.principal.user_id,
                    MCPConnection.workspace_id == context.scope.workspace_id,
                    MCPConnection.organization_id == context.scope.organization_id,
                    ApiToken.user_id == context.principal.user_id,
                )
            )
        ).first()
        if row is None:
            raise NotFoundError("connection_not_found", "Connection not found")
        connection, token = row
        if token.revoked_at or (token.expires_at and token.expires_at <= datetime.now(UTC)):
            raise ConflictError("token_unavailable", "Expired or revoked token")
        if not connection.encrypted_token:
            raise ConflictError(
                "legacy_token", "Original token was not retained; issue a new token"
            )
        if connection.encryption_key_version != settings.integration_encryption_key_version:
            raise ConflictError("token_key_unavailable", "Token encryption key is unavailable")
        try:
            cipher = SecretCipher(
                settings.integration_encryption_key.get_secret_value(),
                connection.encryption_key_version,
            )
            value = cipher.decrypt_json(connection.encrypted_token)
            plaintext = value["token"]
            if value.get("purpose") != "mcp-token" or value.get("connection_id") != str(
                connection.id
            ):
                raise ValueError("Invalid credential binding")
            if not isinstance(plaintext, str) or not compare_digest(
                token_digest(plaintext, settings.auth_token_secret.get_secret_value()),
                token.token_digest,
            ):
                raise ValueError("Invalid credential digest")
        except (InvalidTag, ValueError, TypeError, KeyError) as error:
            raise ConflictError(
                "token_decryption_failed", "Token could not be retrieved"
            ) from error
        return {"id": connection.id, "token": plaintext}

    async def revoke(self, context: AuthorizedContext, connection_id: UUID):
        require_context(context, "token.revoke")
        connection = await self.session.scalar(
            select(MCPConnection).where(
                MCPConnection.id == connection_id,
                MCPConnection.user_id == context.principal.user_id,
                MCPConnection.workspace_id == context.scope.workspace_id,
                MCPConnection.organization_id == context.scope.organization_id,
            )
        )
        if connection is None:
            raise NotFoundError("connection_not_found", "Connection not found")
        await self.session.execute(
            update(ApiToken)
            .where(
                ApiToken.id == connection.token_id, ApiToken.user_id == context.principal.user_id
            )
            .values(revoked_at=datetime.now(UTC))
        )
        connection.encrypted_token = None
        connection.encryption_key_version = None
        await self.session.commit()

    async def purge(self, context: AuthorizedContext, connection_id: UUID):
        require_context(context, "token.revoke")
        await self._ensure_available(context)
        row = (
            await self.session.execute(
                select(MCPConnection, ApiToken)
                .join(ApiToken, ApiToken.id == MCPConnection.token_id)
                .where(
                    MCPConnection.id == connection_id,
                    MCPConnection.user_id == context.principal.user_id,
                    MCPConnection.workspace_id == context.scope.workspace_id,
                    MCPConnection.organization_id == context.scope.organization_id,
                    ApiToken.user_id == context.principal.user_id,
                )
                .with_for_update()
            )
        ).first()
        if row is None:
            raise NotFoundError("connection_not_found", "Connection not found")
        connection, token = row
        if token.revoked_at is None:
            raise ConflictError(
                "token_not_revoked", "Revoke the token before permanently deleting it"
            )
        await self.session.delete(connection)
        await self.session.flush()
        await self.session.delete(token)
        await self.session.commit()
