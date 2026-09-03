"""Official MCP SDK bearer-token verifier backed by Agent Factory API tokens."""

from datetime import UTC, datetime

from mcp.server.auth.provider import AccessToken

from app.core.config import Settings
from app.db.session import get_session_factory
from app.modules.auth.crypto import token_digest
from app.modules.auth.repository import AuthRepository
from app.modules.identity.models import UserStatus


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
        if record is None or record.user.status is not UserStatus.ACTIVE:
            return None
        return AccessToken(
            token=token,
            client_id="agent-factory-api-token",
            scopes=record.token.scopes,
            expires_at=(
                int(record.token.expires_at.timestamp()) if record.token.expires_at else None
            ),
            subject=str(record.user.id),
            resource=f"{self.settings.public_base_url.rstrip('/')}/mcp",
            claims={
                "email": record.user.email,
                "display_name": record.user.display_name,
                "is_platform_admin": record.user.is_platform_admin,
            },
        )
