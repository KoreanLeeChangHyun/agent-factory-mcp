from __future__ import annotations

import base64
import hashlib
import re
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol, cast
from uuid import UUID

from agent_factory_core.identity.authorization import (
    AuthorizationScope,
    AuthorizationService,
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ApplicationError, ConflictError, NotFoundError

from .domain import ConnectionStatus

OAUTH_SCOPES = {
    "google-drive": frozenset({"https://www.googleapis.com/auth/drive.readonly"}),
    "gmail": frozenset({"https://www.googleapis.com/auth/gmail.readonly"}),
    "onedrive": frozenset({"Files.Read", "Files.Read.All", "offline_access"}),
    "slack": frozenset(
        {"channels:history", "groups:history", "im:history", "mpim:history", "files:read"}
    ),
    "notion": frozenset(),
}
TOKEN_PROVIDERS = frozenset({"slack", "notion", "discord"})


@dataclass(frozen=True, slots=True)
class CredentialConnection:
    id: UUID
    workspace_id: UUID
    provider_id: UUID
    provider: str
    status: ConnectionStatus
    encrypted_credentials: bytes | None
    key_version: int | None


@dataclass(frozen=True, slots=True)
class OAuthState:
    workspace_id: UUID
    provider_id: UUID
    user_id: UUID
    state_digest: bytes
    encrypted_context: bytes
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ResolvedOAuthState:
    organization_id: UUID
    provider: str
    state: OAuthState


@dataclass(frozen=True, slots=True)
class OAuthStart:
    authorization_url: str
    expires_at: datetime
    requested_scopes: tuple[str, ...]


class ProviderCredentialRepository(Protocol):
    async def connection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> CredentialConnection | None: ...
    def guard(
        self, workspace_id: UUID, connection_id: UUID
    ) -> AbstractAsyncContextManager[None]: ...
    async def save_oauth_state(self, state: OAuthState) -> None: ...
    async def resolve_oauth_state(
        self, provider: str, user_id: UUID, digest: bytes, now: datetime
    ) -> ResolvedOAuthState | None: ...
    async def consume_oauth_state(
        self,
        organization_id: UUID,
        workspace_id: UUID,
        user_id: UUID,
        digest: bytes,
        now: datetime,
    ) -> OAuthState | None: ...
    async def save_oauth_failure(
        self, connection: CredentialConnection, *, error_code: str
    ) -> None: ...
    async def save_credentials(
        self,
        connection: CredentialConnection,
        *,
        encrypted_credentials: bytes,
        key_version: int,
        requested_scopes: tuple[str, ...],
        granted_scopes: tuple[str, ...] | None,
        status: ConnectionStatus,
    ) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class CredentialSecrets(Protocol):
    @property
    def key_version(self) -> int: ...
    def issue(self) -> str: ...
    def digest(self, value: str) -> bytes: ...
    def encrypt(self, value: dict[str, object]) -> bytes: ...
    def decrypt(self, value: bytes, key_version: int) -> dict[str, object]: ...


class OAuthProvider(Protocol):
    def configuration_identity(self, provider: str) -> str: ...
    def authorization_url(
        self, provider: str, scopes: tuple[str, ...], state: str, challenge: str
    ) -> str: ...
    async def exchange(self, provider: str, *, code: str, verifier: str) -> dict[str, object]: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class ProviderCredentialUseCases:
    def __init__(
        self,
        repository: ProviderCredentialRepository,
        secrets: CredentialSecrets,
        oauth: OAuthProvider,
        clock: Clock,
    ) -> None:
        self.repository = repository
        self.secrets = secrets
        self.oauth = oauth
        self.clock = clock

    async def set_token(
        self,
        context: AuthorizedContext,
        connection_id: UUID,
        *,
        token: str,
        approved_scopes: list[str],
    ) -> dict[str, object]:
        require_context(context, "integration.update")
        workspace_id = require_workspace_id(context)
        if not 1 <= len(token) <= 10_000 or any(character.isspace() for character in token):
            raise ApplicationError("invalid_api_token", "API token is invalid", 422)
        async with self.repository.guard(workspace_id, connection_id):
            connection = await self._connection(workspace_id, connection_id)
            if connection.provider not in TOKEN_PROVIDERS:
                raise ApplicationError("api_token_unsupported", "Provider requires OAuth", 422)
            allowed = OAUTH_SCOPES.get(connection.provider, frozenset())
            if set(approved_scopes) - allowed:
                raise ApplicationError("unsupported_scope", "Scope is not approved", 422)
            await self.repository.save_credentials(
                connection,
                encrypted_credentials=self.secrets.encrypt({"access_token": token}),
                key_version=self.secrets.key_version,
                requested_scopes=tuple(sorted(set(approved_scopes))),
                granted_scopes=None,
                status=ConnectionStatus.ACTIVE,
            )
            await self.repository.commit()
        return {"connection_id": str(connection_id), "health": "unknown", "granted_scopes": None}

    async def begin(
        self, context: AuthorizedContext, connection_id: UUID, scopes: list[str]
    ) -> OAuthStart:
        require_context(context, "integration.update")
        workspace_id = require_workspace_id(context)
        connection = await self._connection(workspace_id, connection_id)
        requested = tuple(sorted(set(scopes)))
        allowed = OAUTH_SCOPES.get(connection.provider)
        if allowed is None or len(requested) > 10 or set(requested) - allowed:
            raise ApplicationError("unsupported_scope", "OAuth scope is not approved", 422)
        if connection.provider in {"google-drive", "gmail"} and set(requested) != allowed:
            raise ApplicationError("required_scope_missing", "Required OAuth scope is missing", 422)
        if connection.provider == "onedrive" and not {"Files.Read", "Files.Read.All"} & set(
            requested
        ):
            raise ApplicationError("required_scope_missing", "A file-read scope is required", 422)
        state, verifier = self.secrets.issue(), self.secrets.issue()
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        authorization_url = self.oauth.authorization_url(
            connection.provider, requested, state, challenge
        )
        expires_at = self.clock.now() + timedelta(minutes=10)
        await self.repository.save_oauth_state(
            OAuthState(
                workspace_id,
                connection.provider_id,
                context.principal.user_id,
                self.secrets.digest(state),
                self.secrets.encrypt(
                    {
                        "verifier": verifier,
                        "connection_id": str(connection_id),
                        "scopes": list(requested),
                        "provider": connection.provider,
                        "configuration": self.oauth.configuration_identity(connection.provider),
                    }
                ),
                expires_at,
            )
        )
        await self.repository.commit()
        return OAuthStart(authorization_url, expires_at, requested)

    async def complete(
        self, context: AuthorizedContext, *, provider: str | None, state: str, code: str
    ) -> dict[str, object]:
        require_context(context, "integration.update")
        if not 1 <= len(state) <= 512 or not 1 <= len(code) <= 10_000:
            raise ApplicationError("invalid_oauth_callback", "OAuth callback is invalid", 422)
        workspace_id = require_workspace_id(context)
        record = await self.repository.consume_oauth_state(
            context.scope.organization_id,
            workspace_id,
            context.principal.user_id,
            self.secrets.digest(state),
            self.clock.now(),
        )
        if record is None:
            raise NotFoundError("invalid_oauth_state", "OAuth state is invalid or expired")
        if record.expires_at <= self.clock.now():
            raise NotFoundError("invalid_oauth_state", "OAuth state is invalid or expired")
        try:
            data = self.secrets.decrypt(record.encrypted_context, self.secrets.key_version)
            connection_id = UUID(str(data["connection_id"]))
            verifier = str(data["verifier"])
            scopes = tuple(str(value) for value in cast(list[object], data["scopes"]))
            # Transitional MCP OAuth states used redirect_uri before the target
            # callback stored explicit provider/configuration identities.
            state_provider = str(data["provider"]) if "provider" in data else None
            raw_configuration = (
                data["configuration"] if "configuration" in data else data["redirect_uri"]
            )
            configuration = str(raw_configuration)
        except (KeyError, TypeError, ValueError) as error:
            raise ConflictError(
                "oauth_state_unavailable", "OAuth state cannot be decrypted"
            ) from error
        async with self.repository.guard(workspace_id, connection_id):
            connection = await self._connection(workspace_id, connection_id)
            if (
                connection.provider_id != record.provider_id
                or (provider is not None and connection.provider != provider)
                or (state_provider is not None and state_provider != connection.provider)
                or configuration != self.oauth.configuration_identity(connection.provider)
            ):
                raise ConflictError("oauth_configuration_changed", "OAuth configuration changed")
            try:
                credentials = await self.oauth.exchange(
                    connection.provider, code=code, verifier=verifier
                )
                access_token = credentials.get("access_token")
                if not isinstance(access_token, str) or not access_token:
                    raise ApplicationError(
                        "oauth_exchange_failed", "Provider returned no token", 502
                    )
            except Exception as error:
                await self.repository.save_oauth_failure(
                    connection, error_code="oauth_exchange_failed"
                )
                await self.repository.commit()
                if isinstance(error, ApplicationError):
                    raise
                raise ApplicationError(
                    "oauth_exchange_failed", "OAuth credential exchange failed", 502
                ) from error
            granted = self._scopes(credentials.get("scope"))
            excess = set(granted or ()) - set(scopes)
            status = ConnectionStatus.PENDING if excess else ConnectionStatus.ACTIVE
            await self.repository.save_credentials(
                connection,
                encrypted_credentials=self.secrets.encrypt(credentials),
                key_version=self.secrets.key_version,
                requested_scopes=scopes,
                granted_scopes=granted,
                status=status,
            )
            await self.repository.commit()
        return {
            "connection_id": str(connection_id),
            "status": status.value,
            "requested_scopes": list(scopes),
            "granted_scopes": list(granted) if granted is not None else None,
            "excess_scopes": sorted(excess),
        }

    async def _connection(self, workspace_id: UUID, connection_id: UUID) -> CredentialConnection:
        connection = await self.repository.connection(workspace_id, connection_id)
        if connection is None:
            raise NotFoundError("integration_connection_not_found", "Connection not found")
        return connection

    @staticmethod
    def _scopes(value: object) -> tuple[str, ...] | None:
        if not isinstance(value, str):
            return None
        return tuple(sorted(set(re.split(r"[ ,]+", value.strip())) - {""}))


class ProviderOAuthCallbackUseCases:
    def __init__(
        self,
        credentials: ProviderCredentialUseCases,
        repository: ProviderCredentialRepository,
        secrets: CredentialSecrets,
        authorization: AuthorizationService,
        clock: Clock,
    ) -> None:
        self.credentials = credentials
        self.repository = repository
        self.secrets = secrets
        self.authorization = authorization
        self.clock = clock

    async def handle(
        self,
        principal: Principal,
        provider: str,
        *,
        state: str,
        code: str,
        denied: bool,
    ) -> UUID:
        if provider not in OAUTH_SCOPES or not 1 <= len(state) <= 512:
            raise NotFoundError("invalid_oauth_state", "OAuth state is invalid or expired")
        resolved = await self.repository.resolve_oauth_state(
            provider, principal.user_id, self.secrets.digest(state), self.clock.now()
        )
        if resolved is None:
            raise NotFoundError("invalid_oauth_state", "OAuth state is invalid or expired")
        context = await self.authorization.authorize(
            principal,
            AuthorizationScope(resolved.organization_id, resolved.state.workspace_id),
            "integration.update",
        )
        if denied:
            consumed = await self.repository.consume_oauth_state(
                resolved.organization_id,
                resolved.state.workspace_id,
                principal.user_id,
                self.secrets.digest(state),
                self.clock.now(),
            )
            if consumed is None or consumed.provider_id != resolved.state.provider_id:
                raise NotFoundError("invalid_oauth_state", "OAuth state is invalid or expired")
            await self.repository.commit()
        else:
            await self.credentials.complete(context, provider=provider, state=state, code=code)
        return resolved.state.workspace_id
