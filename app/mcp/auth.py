"""Official MCP SDK bearer-token verifier backed by Agent Factory API tokens."""

from datetime import UTC, datetime

from mcp.server.auth.provider import AccessToken
from sqlalchemy import select

from app.common.errors import ApplicationError
from app.core.config import Settings
from app.db.session import get_session_factory
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.crypto import token_digest
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import Principal
from agent_factory_core.identity import UserStatus
from app.modules.mcp_connection.models import MCPConnection
from app.modules.organization.permissions import token_permissions
from app.modules.workspace.models import Workspace, WorkspaceStatus


class ApiTokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def verify_token(self, token: str) -> AccessToken | None:
        if not token.startswith("afm_"):
            return None
        async with get_session_factory()() as session:
            record = await AuthRepository(session).resolve_api_token(
                token_digest(token, self.settings.auth_token_secret.get_secret_value()),
                datetime.now(UTC),
            )
            connection = None
            if record is not None:
                await AuthRepository(session)._enable_identity_lookup()
                connection = await session.scalar(
                    select(MCPConnection).where(MCPConnection.token_id == record.token.id)
                )
        if record is None or record.user.status is not UserStatus.ACTIVE:
            return None
        if connection is not None:
            principal = Principal(
                record.user.id,
                record.user.email,
                record.user.display_name,
                record.user.is_platform_admin,
            )
            async with get_session_factory()() as session:
                try:
                    await AuthorizationService(AuthorizationRepository(session)).authorize_any(
                        principal,
                        AuthorizationScope(connection.organization_id, connection.workspace_id),
                        token_permissions(record.token.scopes),
                    )
                    active = await session.scalar(
                        select(Workspace.id).where(
                            Workspace.id == connection.workspace_id,
                            Workspace.status == WorkspaceStatus.ACTIVE,
                        )
                    )
                    if active is None:
                        return None
                except ApplicationError:
                    return None
        return AccessToken(
            token=token,
            client_id=f"agent-factory-connection:{connection.id}"
            if connection
            else "agent-factory-api-token",
            scopes=list(record.token.scopes),
            expires_at=(
                int(record.token.expires_at.timestamp()) if record.token.expires_at else None
            ),
            subject=str(record.user.id),
            resource=f"{self.settings.public_base_url.rstrip('/')}/mcp",
            claims={
                **(
                    {
                        "connection_id": str(connection.id),
                        "workspace_id": str(connection.workspace_id),
                        "organization_id": str(connection.organization_id),
                    }
                    if connection
                    else {}
                ),
                "email": record.user.email,
                "display_name": record.user.display_name,
                "is_platform_admin": record.user.is_platform_admin,
            },
        )
