import io
import zipfile
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from agent_factory_core.connections.mcp.configuration import (
    CLIENT_ENVIRONMENTS,
    MCPConfigurationUseCases,
)
from agent_factory_core.connections.mcp.domain import MCPConnection, MCPConnectionState
from agent_factory_core.connections.mcp.use_cases import MCPConnectionUseCases
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.organizations.permissions import CATALOG, WORKSPACE_PERMISSIONS
from agent_factory_core.shared.errors import ConflictError

NOW = datetime(2026, 9, 13, tzinfo=UTC)


class Clock:
    def now(self) -> datetime:
        return NOW


class Secrets:
    key_version = 3

    def __init__(self) -> None:
        self.value: dict[str, object] = {}
        self.decrypt_calls = 0

    def issue(self) -> str:
        return "opaque"

    def digest(self, plaintext: str) -> bytes:
        return plaintext.encode()

    def encrypt(self, value: dict[str, object]) -> bytes:
        self.value = value
        return b"ciphertext"

    def decrypt(self, ciphertext: bytes, key_version: int) -> dict[str, object]:
        self.decrypt_calls += 1
        return self.value


class Repository:
    def __init__(self) -> None:
        self.created: dict[str, object] | None = None
        self.secret_row: tuple[MCPConnection, bytes, int, bytes] | None = None
        self.lookup_now: datetime | None = None

    async def workspace_available(self, organization_id, workspace_id):
        return True

    async def create(self, **values):
        self.created = values
        return MCPConnection(
            values["connection_id"],
            values["user_id"],
            values["organization_id"],
            values["workspace_id"],
            uuid4(),
            values["name"],
            MCPConnectionState.PENDING,
            True,
            values["expires_at"],
        )

    async def encrypted_secret(self, connection_id, user_id, organization_id, workspace_id, now):
        self.lookup_now = now
        return self.secret_row

    async def list_owned(self, user_id, organization_id, workspace_id, now):
        return [self.secret_row[0]] if self.secret_row else []

    async def commit(self):
        pass


def context(permissions: frozenset[str]) -> AuthorizedContext:
    return AuthorizedContext(
        Principal(uuid4(), "user@example.test", "User", False),
        AuthorizationScope(uuid4(), uuid4()),
        permissions,
    )


def connection(*, retrievable: bool = True, reason: str | None = None) -> MCPConnection:
    return MCPConnection(
        uuid4(),
        uuid4(),
        uuid4(),
        uuid4(),
        uuid4(),
        "Laptop",
        MCPConnectionState.REAUTH_REQUIRED if reason else MCPConnectionState.PENDING,
        retrievable,
        NOW - timedelta(seconds=1) if reason == "expired" else NOW + timedelta(days=1),
        reason=reason,
    )


@pytest.mark.asyncio
async def test_issue_limits_platform_admin_and_mixed_permissions_to_workspace_scopes() -> None:
    repository, secrets = Repository(), Secrets()
    service = MCPConnectionUseCases(repository, secrets, Clock())
    mixed = frozenset(CATALOG) | {"invented.permission"}

    result = await service.issue(context(mixed), "Laptop")

    assert result.plaintext_token == "afm_opaque"
    assert repository.created is not None
    assert set(repository.created["scopes"]) == {
        permission.replace(".", ":") for permission in WORKSPACE_PERMISSIONS
    }
    assert "agent:report" in repository.created["scopes"]
    assert all(not scope.startswith("organization:") for scope in repository.created["scopes"])


@pytest.mark.asyncio
@pytest.mark.parametrize("reason", ["expired", "revoked", "legacy"])
async def test_unavailable_secret_is_never_decrypted(reason: str) -> None:
    repository, secrets = Repository(), Secrets()
    repository.secret_row = (connection(retrievable=False, reason=reason), b"ciphertext", 3, b"")
    service = MCPConnectionUseCases(repository, secrets, Clock())

    with pytest.raises(ConflictError, match="token_unavailable"):
        await service.reveal(context(frozenset({"token.read"})), uuid4())

    assert repository.lookup_now == NOW
    assert secrets.decrypt_calls == 0


@pytest.mark.asyncio
async def test_key_version_mismatch_is_closed_before_decryption() -> None:
    repository, secrets = Repository(), Secrets()
    repository.secret_row = (connection(), b"ciphertext", 2, b"")

    with pytest.raises(ConflictError, match="token_key_unavailable"):
        await MCPConnectionUseCases(repository, secrets, Clock()).reveal(
            context(frozenset({"token.read"})), uuid4()
        )

    assert secrets.decrypt_calls == 0


@pytest.mark.asyncio
async def test_digest_or_connection_binding_mismatch_is_closed() -> None:
    repository, secrets = Repository(), Secrets()
    record = connection()
    secrets.value = {
        "purpose": "mcp-token",
        "connection_id": str(record.id),
        "token": "plaintext",
    }
    repository.secret_row = (record, b"ciphertext", 3, b"different")

    with pytest.raises(ConflictError, match="token_decryption_failed"):
        await MCPConnectionUseCases(repository, secrets, Clock()).reveal(
            context(frozenset({"token.read"})), record.id
        )


@pytest.mark.asyncio
async def test_configuration_bundle_contains_all_environments_and_secret_free_instructions() -> (
    None
):
    repository, secrets = Repository(), Secrets()
    authorized = context(frozenset({"token.read"}))
    record = MCPConnection(
        uuid4(),
        authorized.principal.user_id,
        authorized.scope.organization_id,
        authorized.scope.workspace_id,
        uuid4(),
        "Laptop",
        MCPConnectionState.PENDING,
        True,
        NOW + timedelta(days=1),
    )
    token = "afm_bundle_secret"
    secrets.value = {"purpose": "mcp-token", "connection_id": str(record.id), "token": token}
    repository.secret_row = (record, b"ciphertext", 3, token.encode())
    service = MCPConfigurationUseCases(
        MCPConnectionUseCases(repository, secrets, Clock()), "https://factory.example"
    )

    result = await service.bundle(authorized, record.id)

    assert token not in result.instructions
    with zipfile.ZipFile(io.BytesIO(result.body)) as archive:
        names = set(archive.namelist())
        assert {"credentials.json", "connection.json", "README.txt"} <= names
        assert sum(
            name.startswith("clients/") and "mcp-settings." in name for name in names
        ) == len(CLIENT_ENVIRONMENTS)
        assert token in archive.read("credentials.json").decode()
        manifest = archive.read("connection.json").decode()
        assert '"server_url": "https://factory.example/mcp"' in manifest
        for name in names:
            if name.startswith("clients/") and "mcp-settings." in name:
                assert "https://factory.example/mcp" in archive.read(name).decode()
                assert "/mcp/workspaces/" not in archive.read(name).decode()
