from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from agent_factory_core.connections.providers.credentials import (
    CredentialConnection,
    ProviderCredentialUseCases,
    ProviderOAuthCallbackUseCases,
    ResolvedOAuthState,
)
from agent_factory_core.connections.providers.domain import ConnectionStatus
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import (
    ApplicationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

NOW = datetime(2026, 9, 13, tzinfo=UTC)


class Clock:
    def now(self):
        return NOW


class ExpiredClock:
    def now(self):
        return NOW + timedelta(minutes=11)


class Secrets:
    key_version = 4

    def __init__(self):
        self.values = {}
        self.issued = 0

    def issue(self):
        self.issued += 1
        return "state" if self.issued == 1 else "verifier"

    def digest(self, value):
        return value.encode()

    def encrypt(self, value):
        key = f"cipher-{len(self.values)}".encode()
        self.values[key] = value
        return key

    def decrypt(self, value, key_version):
        return self.values[value]


class OAuth:
    def __init__(self):
        self.configuration = "configured-callback"
        self.exchanges = 0

    def configuration_identity(self, provider):
        return self.configuration

    def authorization_url(self, provider, scopes, state, challenge):
        return f"https://accounts.example/authorize?state={state}"

    async def exchange(self, provider, *, code, verifier):
        self.exchanges += 1
        return {"access_token": "access", "scope": "Files.Read Files.Read.All"}


class FailingOAuth(OAuth):
    async def exchange(self, provider, *, code, verifier):
        self.exchanges += 1
        raise RuntimeError("provider included a sensitive response")


class Repository:
    def __init__(self, connection):
        self.value = connection
        self.state = None
        self.saved = None
        self.oauth_failure = None
        self.guard_entries = 0
        self.organization_id = uuid4()

    async def connection(self, workspace_id, connection_id):
        return self.value if self.value.id == connection_id else None

    @asynccontextmanager
    async def guard(self, workspace_id, connection_id):
        self.guard_entries += 1
        yield

    async def save_oauth_state(self, state):
        self.state = state

    async def resolve_oauth_state(self, provider, user_id, digest, now):
        if (
            self.state is None
            or self.state.user_id != user_id
            or self.state.state_digest != digest
            or self.state.expires_at <= now
            or provider != self.value.provider
        ):
            return None
        return ResolvedOAuthState(self.organization_id, provider, self.state)

    async def consume_oauth_state(self, organization_id, workspace_id, user_id, digest, now):
        if (
            self.state is None
            or self.state.workspace_id != workspace_id
            or self.state.user_id != user_id
            or self.state.state_digest != digest
            or self.state.expires_at <= now
        ):
            return None
        state, self.state = self.state, None
        return state

    async def save_oauth_failure(self, connection, *, error_code):
        self.oauth_failure = error_code

    async def save_credentials(self, connection, **values):
        self.saved = values

    async def commit(self):
        pass

    async def rollback(self):
        pass


def context(workspace_id):
    return AuthorizedContext(
        Principal(uuid4(), "owner@example.test", "Owner", False),
        AuthorizationScope(uuid4(), workspace_id),
        frozenset({"integration.update"}),
    )


class Authorization:
    def __init__(self, authorized):
        self.authorized = authorized

    async def authorize(self, principal, scope, permission):
        if principal.user_id != self.authorized.principal.user_id:
            raise PermissionDeniedError("permission_required", "different user")
        if scope.workspace_id != self.authorized.scope.workspace_id:
            raise PermissionDeniedError("permission_required", "different workspace")
        return self.authorized


@pytest.mark.asyncio
async def test_oauth_state_is_bound_and_excess_scope_requires_review() -> None:
    workspace_id, provider_id, connection_id = uuid4(), uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        provider_id,
        "onedrive",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository, secrets = Repository(connection), Secrets()
    service = ProviderCredentialUseCases(repository, secrets, OAuth(), Clock())
    authorized = context(workspace_id)

    start = await service.begin(authorized, connection_id, ["Files.Read"])
    result = await service.complete(authorized, provider="onedrive", state="state", code="code")

    assert start.requested_scopes == ("Files.Read",)
    assert result["status"] == "pending"
    assert result["excess_scopes"] == ["Files.Read.All"]
    assert repository.saved["status"] == ConnectionStatus.PENDING
    assert repository.guard_entries == 1


@pytest.mark.asyncio
async def test_scoped_mcp_completion_derives_provider_from_bound_state() -> None:
    workspace_id, provider_id, connection_id = uuid4(), uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        provider_id,
        "onedrive",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository, secrets, oauth = Repository(connection), Secrets(), OAuth()
    service = ProviderCredentialUseCases(repository, secrets, oauth, Clock())
    authorized = context(workspace_id)
    await service.begin(authorized, connection_id, ["Files.Read"])
    repository.state = replace(
        repository.state,
        encrypted_context=secrets.encrypt(
            {
                "verifier": "verifier",
                "connection_id": str(connection_id),
                "scopes": ["Files.Read"],
                "redirect_uri": oauth.configuration,
            }
        ),
    )

    completed = await service.complete(
        authorized, provider=None, state="state", code="code"
    )

    assert completed["connection_id"] == str(connection_id)
    assert oauth.exchanges == 1
    assert repository.state is None
    assert repository.saved is not None


@pytest.mark.asyncio
async def test_oauth_exchange_failure_is_safe_and_state_remains_single_use() -> None:
    workspace_id, connection_id = uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        uuid4(),
        "onedrive",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository, secrets, oauth = Repository(connection), Secrets(), FailingOAuth()
    service = ProviderCredentialUseCases(repository, secrets, oauth, Clock())
    authorized = context(workspace_id)
    await service.begin(authorized, connection_id, ["Files.Read"])

    with pytest.raises(ApplicationError, match="oauth_exchange_failed"):
        await service.complete(authorized, provider="onedrive", state="state", code="code")

    assert oauth.exchanges == 1
    assert repository.oauth_failure == "oauth_exchange_failed"
    assert repository.state is None
    with pytest.raises(NotFoundError, match="invalid_oauth_state"):
        await service.complete(authorized, provider="onedrive", state="state", code="code")


@pytest.mark.asyncio
async def test_token_credentials_are_saved_only_inside_guard() -> None:
    workspace_id, connection_id = uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        uuid4(),
        "notion",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository = Repository(connection)

    await ProviderCredentialUseCases(repository, Secrets(), OAuth(), Clock()).set_token(
        context(workspace_id), connection_id, token="secret", approved_scopes=[]
    )

    assert repository.guard_entries == 1
    assert repository.saved["status"] == ConnectionStatus.ACTIVE


@pytest.mark.asyncio
async def test_browser_callback_reauthorizes_durable_state_and_handles_denial() -> None:
    workspace_id, connection_id = uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        uuid4(),
        "onedrive",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository, secrets, oauth = Repository(connection), Secrets(), OAuth()
    authorized = context(workspace_id)
    credentials = ProviderCredentialUseCases(repository, secrets, oauth, Clock())
    callback = ProviderOAuthCallbackUseCases(
        credentials, repository, secrets, Authorization(authorized), Clock()
    )
    await credentials.begin(authorized, connection_id, ["Files.Read"])

    returned_workspace = await callback.handle(
        authorized.principal, "onedrive", state="state", code="code", denied=False
    )

    assert returned_workspace == workspace_id
    assert oauth.exchanges == 1

    secrets = Secrets()
    repository = Repository(connection)
    oauth = OAuth()
    credentials = ProviderCredentialUseCases(repository, secrets, oauth, Clock())
    callback = ProviderOAuthCallbackUseCases(
        credentials, repository, secrets, Authorization(authorized), Clock()
    )
    await credentials.begin(authorized, connection_id, ["Files.Read"])

    await callback.handle(authorized.principal, "onedrive", state="state", code="", denied=True)

    assert oauth.exchanges == 0
    assert repository.state is None


@pytest.mark.asyncio
async def test_browser_callback_completes_transitional_mcp_state_once() -> None:
    workspace_id, connection_id = uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        uuid4(),
        "onedrive",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository, secrets, oauth = Repository(connection), Secrets(), OAuth()
    authorized = context(workspace_id)
    credentials = ProviderCredentialUseCases(repository, secrets, oauth, Clock())
    callback = ProviderOAuthCallbackUseCases(
        credentials, repository, secrets, Authorization(authorized), Clock()
    )
    await credentials.begin(authorized, connection_id, ["Files.Read"])
    repository.state = replace(
        repository.state,
        encrypted_context=secrets.encrypt(
            {
                "verifier": "verifier",
                "connection_id": str(connection_id),
                "scopes": ["Files.Read"],
                "redirect_uri": oauth.configuration,
            }
        ),
    )

    returned_workspace = await callback.handle(
        authorized.principal, "onedrive", state="state", code="code", denied=False
    )

    assert returned_workspace == workspace_id
    assert oauth.exchanges == 1
    assert repository.saved is not None
    with pytest.raises(NotFoundError, match="invalid_oauth_state"):
        await callback.handle(
            authorized.principal, "onedrive", state="state", code="code", denied=False
        )
    assert oauth.exchanges == 1


@pytest.mark.asyncio
async def test_callback_rejects_replay_user_workspace_and_configuration_changes() -> None:
    workspace_id, connection_id = uuid4(), uuid4()
    connection = CredentialConnection(
        connection_id,
        workspace_id,
        uuid4(),
        "onedrive",
        ConnectionStatus.PENDING,
        None,
        None,
    )
    repository, secrets, oauth = Repository(connection), Secrets(), OAuth()
    authorized = context(workspace_id)
    credentials = ProviderCredentialUseCases(repository, secrets, oauth, Clock())
    callback = ProviderOAuthCallbackUseCases(
        credentials, repository, secrets, Authorization(authorized), Clock()
    )
    await credentials.begin(authorized, connection_id, ["Files.Read"])

    with pytest.raises(NotFoundError, match="invalid_oauth_state"):
        await callback.handle(
            Principal(uuid4(), "other@example.test", "Other", False),
            "onedrive",
            state="state",
            code="code",
            denied=False,
        )
    with pytest.raises(NotFoundError, match="invalid_oauth_state"):
        await ProviderOAuthCallbackUseCases(
            credentials, repository, secrets, Authorization(authorized), ExpiredClock()
        ).handle(authorized.principal, "onedrive", state="state", code="code", denied=False)
    repository.organization_id = uuid4()
    wrong_workspace = AuthorizedContext(
        authorized.principal,
        AuthorizationScope(authorized.scope.organization_id, uuid4()),
        authorized.permissions,
    )
    with pytest.raises(PermissionDeniedError):
        await ProviderOAuthCallbackUseCases(
            credentials, repository, secrets, Authorization(wrong_workspace), Clock()
        ).handle(authorized.principal, "onedrive", state="state", code="code", denied=False)

    oauth.configuration = "changed-callback"
    with pytest.raises(ConflictError, match="oauth_configuration_changed"):
        await callback.handle(
            authorized.principal, "onedrive", state="state", code="code", denied=False
        )
    with pytest.raises(NotFoundError, match="invalid_oauth_state"):
        await callback.handle(
            authorized.principal, "onedrive", state="state", code="code", denied=False
        )
