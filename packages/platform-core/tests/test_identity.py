"""Pure identity use-case tests through deterministic in-memory ports."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from agent_factory_core.identity import (
    ApiTokenRecord,
    AuthorizationScope,
    AuthorizationService,
    AuthorizationState,
    AuthService,
    CredentialRecord,
    IdentitySettings,
    PasswordLoginRecord,
    PermissionSource,
    Principal,
    SessionRecord,
    UserRecord,
    UserStatus,
)
from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.organizations.permissions import token_permissions
from agent_factory_core.shared.errors import (
    ApplicationError,
    AuthenticationError,
    PermissionDeniedError,
)

NOW = datetime(2026, 9, 12, tzinfo=UTC)
USER_ID = UUID("11111111-1111-4111-8111-111111111111")
ORG_ID = UUID("22222222-2222-4222-8222-222222222222")
WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")


class Clock:
    def now(self) -> datetime:
        return NOW


class Crypto:
    counter = 0

    def hash_password(self, password: str) -> str:
        if password == "crypto-failure":
            raise RuntimeError("hash failed")
        return f"hash:{password}"

    def verify_password(self, password: str, encoded: str | None) -> tuple[bool, str | None]:
        return encoded == f"hash:{password}", "hash-upgraded" if password == "upgrade" else None

    def new_opaque_token(self) -> str:
        self.counter += 1
        return f"opaque-{self.counter}"

    def token_digest(self, token: str) -> bytes:
        return f"digest:{token}".encode()


class AuthorizationRepository:
    def __init__(
        self,
        permissions: set[str],
        *,
        membership_active: bool = True,
        workspace_exists: bool = True,
        workspace_active: bool = True,
        source: str = "direct",
    ) -> None:
        self.permissions = frozenset(permissions)
        self.membership_active = membership_active
        self.workspace_exists = workspace_exists
        self.workspace_active = workspace_active
        self.source = source
        self.established = False

    async def establish_scope(self, principal: Principal, scope: AuthorizationScope) -> None:
        self.established = True

    async def authorization_state(
        self, principal: Principal, scope: AuthorizationScope
    ) -> AuthorizationState:
        assert self.established
        role_scope = "workspace" if scope.workspace_id else "organization"
        return AuthorizationState(
            self.membership_active,
            self.workspace_exists,
            self.workspace_active,
            sources=(
                PermissionSource(self.source, UUID(int=4), "Member", self.permissions, role_scope),
            ),
        )


class Repository:
    def __init__(self) -> None:
        self.user = UserRecord(USER_ID, "owner@example.test", "Owner", False, UserStatus.ACTIVE)
        self.credential = CredentialRecord(USER_ID, "hash:password", 0, None)
        self.sessions: dict[UUID, SessionRecord] = {}
        self.session_digests: dict[bytes, UUID] = {}
        self.tokens: dict[UUID, ApiTokenRecord] = {}
        self.one_time: dict[tuple[str, bytes], tuple[UUID, datetime]] = {}
        self.commits = 0

    async def find_password_login(self, email: str):
        return PasswordLoginRecord(self.user, self.credential) if email == self.user.email else None

    async def find_user_by_email(self, email: str):
        return self.user if email == self.user.email else None

    async def find_user_by_id(self, user_id: UUID):
        return self.user if user_id == USER_ID else None

    async def record_failed_login(
        self, credential: CredentialRecord, *, locked_until: datetime | None
    ):
        self.credential = replace(
            credential, failed_attempts=credential.failed_attempts + 1, locked_until=locked_until
        )

    async def record_successful_login(
        self, credential: CredentialRecord, updated_password_hash: str | None
    ):
        self.credential = replace(
            credential,
            password_hash=updated_password_hash or credential.password_hash,
            failed_attempts=0,
            locked_until=None,
        )

    async def create_session(
        self, *, user_id: UUID, digest: bytes, expires_at: datetime, user_agent: str | None
    ):
        record = SessionRecord(uuid4(), user_id, NOW, expires_at, None, user_agent)
        self.sessions[record.id] = record
        self.session_digests[digest] = record.id
        return record

    async def resolve_session(self, digest: bytes, now: datetime):
        record = self.sessions.get(self.session_digests.get(digest))
        return (
            self.user if record and record.revoked_at is None and record.expires_at > now else None
        )

    async def revoke_session(self, digest: bytes, now: datetime):
        record = self.sessions[self.session_digests[digest]]
        self.sessions[record.id] = replace(record, revoked_at=now)

    async def list_sessions(self, user_id: UUID):
        return [record for record in self.sessions.values() if record.user_id == user_id]

    async def revoke_session_by_id(self, user_id: UUID, session_id: UUID, now: datetime):
        record = self.sessions[session_id]
        if record.user_id == user_id:
            self.sessions[session_id] = replace(record, revoked_at=now)

    async def find_or_create_external_user(self, **values):
        return self.user

    async def create_api_token(
        self,
        *,
        user_id: UUID,
        name: str,
        digest: bytes,
        scopes: list[str],
        expires_at: datetime | None,
    ):
        record = ApiTokenRecord(uuid4(), user_id, name, tuple(scopes), NOW, expires_at, None, None)
        self.tokens[record.id] = record
        return record

    async def add_mcp_connection(self, **values):
        self.connection = values

    async def list_api_tokens(self, user_id: UUID):
        return [token for token in self.tokens.values() if token.user_id == user_id]

    async def revoke_api_token(self, user_id: UUID, token_id: UUID, now: datetime):
        token = self.tokens[token_id]
        if token.user_id == user_id:
            self.tokens[token_id] = replace(token, revoked_at=now)

    async def create_one_time_token(
        self, *, user_id: UUID, purpose: str, digest: bytes, expires_at: datetime
    ):
        self.one_time[(purpose, digest)] = (user_id, expires_at)

    async def consume_one_time_token(self, *, purpose: str, digest: bytes, now: datetime):
        value = self.one_time.pop((purpose, digest), None)
        return self.user if value and value[1] > now else None

    async def mark_email_verified(self, user: UserRecord, now: datetime):
        self.user = replace(user, email_verified_at=now)

    async def replace_password(self, user: UserRecord, password_hash: str, now: datetime):
        self.credential = replace(
            self.credential, password_hash=password_hash, failed_attempts=0, locked_until=None
        )
        self.sessions = {
            key: replace(value, revoked_at=now) for key, value in self.sessions.items()
        }

    async def commit(self):
        self.commits += 1


def service(repository: Repository, permissions: set[str] | None = None) -> AuthService:
    authorization = AuthorizationRepository(permissions or {"token.create", "document.read"})
    return AuthService(
        repository,
        IdentitySettings(24, 2, 10),
        Clock(),
        Crypto(),
        lambda: AuthorizationService(authorization),
    )


@pytest.mark.asyncio
async def test_login_lockout_hash_upgrade_session_and_logout() -> None:
    repository = Repository()
    auth = service(repository)
    for _ in range(2):
        with pytest.raises(AuthenticationError, match="Invalid email or password"):
            await auth.login(repository.user.email, "wrong", None)
    assert repository.credential.locked_until == NOW + timedelta(minutes=10)
    repository.credential = replace(
        repository.credential, password_hash="hash:upgrade", locked_until=None
    )
    result = await auth.login(repository.user.email, "upgrade", "agent")
    assert repository.credential.password_hash == "hash-upgraded"
    assert await auth.authenticate_session(result.session_token) == result.principal
    await auth.logout(result.session_token)
    with pytest.raises(AuthenticationError):
        await auth.authenticate_session(result.session_token)


@pytest.mark.asyncio
async def test_external_email_reset_and_one_time_semantics() -> None:
    repository = Repository()
    auth = service(repository)
    result = await auth.login_external(
        provider="google",
        subject="sub",
        email=repository.user.email,
        display_name="Owner",
        user_agent=None,
    )
    _, verification = await auth.issue_email_verification(USER_ID)
    await auth.verify_email(verification)
    with pytest.raises(AuthenticationError):
        await auth.verify_email(verification)
    delivery = await auth.issue_password_reset(repository.user.email.upper())
    assert delivery is not None
    await auth.reset_password(delivery[1], "new-password")
    assert repository.credential.password_hash == "hash:new-password"
    with pytest.raises(AuthenticationError):
        await auth.authenticate_session(result.session_token)


@pytest.mark.asyncio
async def test_api_token_scope_subset_list_and_revoke() -> None:
    repository = Repository()
    auth = service(repository)
    token, plaintext = await auth.create_api_token(
        user_id=USER_ID,
        name=" MCP ",
        scopes=["document:read", "document:read"],
        expires_in_days=30,
        organization_id=ORG_ID,
        workspace_id=WORKSPACE_ID,
    )
    assert plaintext.startswith("afm_") and token.scopes == ("document:read",)
    assert await auth.list_api_tokens(USER_ID) == [token]
    await auth.revoke_api_token(USER_ID, token.id)
    assert repository.tokens[token.id].revoked_at == NOW
    with pytest.raises(PermissionDeniedError):
        await service(repository, {"token.create"}).create_api_token(
            user_id=USER_ID,
            name="bad",
            scopes=["document:read"],
            expires_in_days=None,
            organization_id=ORG_ID,
            workspace_id=WORKSPACE_ID,
        )


def test_token_aliases_do_not_expand_to_organization_or_owner_permissions() -> None:
    permissions = token_permissions(["document:write", "integration:manage", "unknown:scope"])
    assert "document.update" in permissions and "integration.update" in permissions
    assert not permissions & {"organization.delete", "organization.transfer"}


@pytest.mark.asyncio
async def test_expired_revoked_and_inactive_sessions_fail_closed() -> None:
    repository = Repository()
    auth = service(repository)
    result = await auth.login(repository.user.email, "password", None)
    session_id = next(iter(repository.sessions))
    repository.sessions[session_id] = replace(repository.sessions[session_id], expires_at=NOW)
    with pytest.raises(AuthenticationError):
        await auth.authenticate_session(result.session_token)
    repository.sessions[session_id] = replace(
        repository.sessions[session_id], expires_at=NOW + timedelta(hours=1)
    )
    repository.user = replace(repository.user, status=UserStatus.SUSPENDED)
    with pytest.raises(AuthenticationError):
        await auth.authenticate_session(result.session_token)


@pytest.mark.asyncio
async def test_crypto_failure_does_not_commit_partial_password_reset() -> None:
    repository = Repository()
    auth = service(repository)
    delivery = await auth.issue_password_reset(repository.user.email)
    assert delivery is not None
    commits = repository.commits
    with pytest.raises(RuntimeError, match="hash failed"):
        await auth.reset_password(delivery[1], "crypto-failure")
    assert repository.commits == commits


@pytest.mark.asyncio
async def test_authorization_intersection_and_structured_scope_guards() -> None:
    principal = Principal(USER_ID, "owner@example.test", "Owner", False)
    repository = AuthorizationRepository({"document.read", "document.update"})
    authorization = AuthorizationService(repository)
    context = await authorization.authorize_any(
        principal, AuthorizationScope(ORG_ID, WORKSPACE_ID), frozenset({"document.read"})
    )
    assert context.permissions == frozenset({"document.read"})
    require_context(context, "document.read")
    assert require_workspace_id(context) == WORKSPACE_ID
    with pytest.raises(PermissionDeniedError):
        require_context(context, "document.update")
    with pytest.raises(PermissionDeniedError):
        await AuthorizationService(AuthorizationRepository(set())).authorize(
            principal, AuthorizationScope(ORG_ID, WORKSPACE_ID), "document.read"
        )
    organization_context = AuthorizedContext(
        principal, AuthorizationScope(ORG_ID), frozenset({"organization.read"})
    )
    with pytest.raises(ApplicationError, match="Workspace scope is required"):
        require_workspace_id(organization_context)


@pytest.mark.asyncio
async def test_suspension_overrides_direct_team_and_owner_grants_but_admin_is_distinct() -> None:
    scope = AuthorizationScope(ORG_ID, WORKSPACE_ID)
    for source in ("direct", "team"):
        repository = AuthorizationRepository(
            {"document.read", "workspace.delete"},
            membership_active=False,
            source=source,
        )
        with pytest.raises(PermissionDeniedError):
            await AuthorizationService(repository).authorize(
                Principal(USER_ID, "member@example.test", "Member", False),
                scope,
                "document.read",
            )
    owner_without_workspace_grant = AuthorizationRepository(set())
    with pytest.raises(PermissionDeniedError):
        await AuthorizationService(owner_without_workspace_grant).authorize(
            Principal(USER_ID, "owner@example.test", "Owner", False),
            scope,
            "document.read",
        )
    admin = await AuthorizationService(AuthorizationRepository(set())).authorize(
        Principal(USER_ID, "admin@example.test", "Admin", True), scope, "document.read"
    )
    assert "organization.delete" in admin.permissions


@pytest.mark.asyncio
async def test_inactive_and_cross_tenant_workspace_state_fails_closed() -> None:
    principal = Principal(USER_ID, "member@example.test", "Member", False)
    for repository in (
        AuthorizationRepository({"document.read"}, workspace_exists=False),
        AuthorizationRepository({"document.read"}, workspace_active=False),
    ):
        with pytest.raises(ApplicationError, match="Workspace not found"):
            await AuthorizationService(repository).authorize(
                principal, AuthorizationScope(ORG_ID, WORKSPACE_ID), "document.read"
            )
