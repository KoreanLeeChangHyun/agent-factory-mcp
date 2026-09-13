from agent_factory_adapters.clock import SystemClock
from agent_factory_adapters.postgres.connections.collections import PostgresCollectionRepository
from agent_factory_adapters.postgres.connections.credentials import (
    PostgresProviderCredentialRepository,
)
from agent_factory_adapters.postgres.connections.mcp import PostgresMCPConnectionRepository
from agent_factory_adapters.postgres.connections.providers import (
    PostgresProviderConnectionRepository,
)
from agent_factory_adapters.postgres.connections.webhooks import PostgresWebhookRepository
from agent_factory_core.connections.mcp.configuration import MCPConfigurationUseCases
from agent_factory_core.connections.mcp.ports import TokenSecrets
from agent_factory_core.connections.mcp.use_cases import MCPConnectionUseCases
from agent_factory_core.connections.providers.collection_ports import (
    CollectionConnections,
    CollectionDocuments,
    CollectionJobs,
)
from agent_factory_core.connections.providers.collection_use_cases import ProviderCollectionUseCases
from agent_factory_core.connections.providers.credentials import (
    CredentialSecrets,
    OAuthProvider,
    ProviderCredentialUseCases,
    ProviderOAuthCallbackUseCases,
)
from agent_factory_core.connections.providers.ports import SecretCipher
from agent_factory_core.connections.providers.use_cases import ProviderConnectionUseCases
from agent_factory_core.connections.providers.webhooks import (
    ProviderWebhookUseCases,
    WebhookDeliveryPublisher,
)
from agent_factory_core.identity.authorization import AuthorizationService
from sqlalchemy.ext.asyncio import AsyncSession


def provider_connection_use_cases(
    session: AsyncSession, cipher: SecretCipher
) -> ProviderConnectionUseCases:
    return ProviderConnectionUseCases(PostgresProviderConnectionRepository(session), cipher)


def provider_credential_use_cases(
    session: AsyncSession, secrets: CredentialSecrets, oauth: OAuthProvider
) -> ProviderCredentialUseCases:
    return ProviderCredentialUseCases(
        PostgresProviderCredentialRepository(session), secrets, oauth, SystemClock()
    )


def provider_oauth_callback_use_cases(
    session: AsyncSession,
    secrets: CredentialSecrets,
    oauth: OAuthProvider,
    authorization: AuthorizationService,
) -> ProviderOAuthCallbackUseCases:
    repository = PostgresProviderCredentialRepository(session)
    credentials = ProviderCredentialUseCases(repository, secrets, oauth, SystemClock())
    return ProviderOAuthCallbackUseCases(
        credentials, repository, secrets, authorization, SystemClock()
    )


def provider_collection_use_cases(
    session: AsyncSession,
    jobs: CollectionJobs,
    connections: CollectionConnections,
    documents: CollectionDocuments,
) -> ProviderCollectionUseCases:
    return ProviderCollectionUseCases(
        PostgresCollectionRepository(session), jobs, connections, documents, SystemClock()
    )


def provider_webhook_use_cases(
    session: AsyncSession,
    secrets: CredentialSecrets,
    *,
    public_base_url: str,
    max_payload_bytes: int,
    publisher: WebhookDeliveryPublisher | None = None,
) -> ProviderWebhookUseCases:
    return ProviderWebhookUseCases(
        PostgresWebhookRepository(session),
        secrets,
        SystemClock(),
        public_base_url,
        max_payload_bytes,
        publisher,
    )


def mcp_connection_use_cases(session: AsyncSession, secrets: TokenSecrets) -> MCPConnectionUseCases:
    return MCPConnectionUseCases(PostgresMCPConnectionRepository(session), secrets, SystemClock())


def mcp_configuration_use_cases(
    session: AsyncSession, secrets: TokenSecrets, public_base_url: str
) -> MCPConfigurationUseCases:
    return MCPConfigurationUseCases(mcp_connection_use_cases(session, secrets), public_base_url)
