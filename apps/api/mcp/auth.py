"""Translate the shared MCP token use case into the official SDK contract."""

from mcp.server.auth.provider import AccessToken

from api.composition.mcp_access import mcp_tokens


class ApiTokenVerifier:
    def __init__(self, settings):
        self.settings = settings

    async def verify_token(self, token: str) -> AccessToken | None:
        async with mcp_tokens(self.settings.auth_token_secret.get_secret_value()) as service:
            resolved = await service.verify(token)
        if resolved is None:
            return None
        record, binding = resolved
        return AccessToken(
            token=token,
            client_id=f"agent-factory-connection:{binding.id}" if binding else "agent-factory-api-token",
            scopes=list(record.token.scopes),
            expires_at=int(record.token.expires_at.timestamp()) if record.token.expires_at else None,
            subject=str(record.user.id),
            resource=f"{self.settings.public_base_url.rstrip('/')}/mcp",
            claims={
                **({"connection_id": str(binding.id), "workspace_id": str(binding.workspace_id),
                    "organization_id": str(binding.organization_id)} if binding else {}),
                "email": record.user.email, "display_name": record.user.display_name,
                "is_platform_admin": record.user.is_platform_admin,
            },
        )
