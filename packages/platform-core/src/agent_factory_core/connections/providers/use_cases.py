from __future__ import annotations

from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import ApplicationError, ConflictError, NotFoundError

from .domain import ConnectionStatus, Provider, ProviderConnection
from .ports import ProviderConnectionRepository, SecretCipher


class ProviderConnectionUseCases:
    def __init__(self, repository: ProviderConnectionRepository, cipher: SecretCipher) -> None:
        self.repository = repository
        self.cipher = cipher

    async def catalog(self, context: AuthorizedContext) -> list[Provider]:
        require_context(context, "integration.read")
        return [row for row in await self.repository.providers() if row.is_enabled]

    async def connections(self, context: AuthorizedContext) -> list[ProviderConnection]:
        require_context(context, "integration.read")
        return await self.repository.connections(require_workspace_id(context))

    async def create(
        self,
        context: AuthorizedContext,
        provider_id: UUID,
        *,
        name: str,
        credentials: dict[str, object] | None = None,
    ) -> ProviderConnection:
        require_context(context, "integration.create")
        workspace_id = require_workspace_id(context)
        if not name.strip() or len(name.strip()) > 160:
            raise ApplicationError("invalid_integration_name", "Connection name is required", 422)
        if not await self.repository.lock_workspace(context.scope.organization_id, workspace_id):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        provider = await self.repository.provider(provider_id)
        if provider is None or not provider.is_enabled:
            raise NotFoundError("integration_provider_not_found", "Integration provider not found")
        encrypted = self.cipher.encrypt(credentials) if credentials else None
        value = ProviderConnection(
            uuid4(),
            workspace_id,
            provider_id,
            name.strip(),
            ConnectionStatus.PENDING,
            credentials_present=bool(encrypted),
        )
        try:
            result = await self.repository.insert_connection(
                value, encrypted, self.cipher.key_version if encrypted else None
            )
            await self.repository.commit()
            return result
        except Exception as error:
            await self.repository.rollback()
            if error.__class__.__name__ == "IntegrityError":
                raise ConflictError(
                    "integration_connection_exists", "Integration connection already exists"
                ) from error
            raise

    async def disconnect(
        self, context: AuthorizedContext, connection_id: UUID
    ) -> ProviderConnection:
        require_context(context, "integration.delete")
        workspace_id = require_workspace_id(context)
        if not await self.repository.lock_workspace(context.scope.organization_id, workspace_id):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        async with self.repository.guard(workspace_id, connection_id):
            result = await self.repository.disconnect(workspace_id, connection_id)
            if result is None:
                raise NotFoundError(
                    "integration_connection_not_found", "Integration connection not found"
                )
            await self.repository.commit()
        return result
