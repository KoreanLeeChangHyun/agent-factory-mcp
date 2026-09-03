"""Authentication cryptography, use-case, and HTTP contract tests."""

from datetime import datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.common.errors import AuthenticationError
from app.core.config import Settings
from app.main import create_app
from app.modules.auth.crypto import hash_password, token_digest, verify_password
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.models import UserCredential
from app.modules.auth.oauth import external_profile
from app.modules.auth.repository import PasswordLoginRecord
from app.modules.auth.service import AuthService, LoginResult, Principal
from app.modules.identity.models import User, UserStatus

USER_ID = UUID("11111111-1111-4111-8111-111111111111")


class FakeRepository:
    def __init__(self, password: str = "correct horse battery staple") -> None:
        self.user = User(
            id=USER_ID,
            email="owner@example.com",
            display_name="Owner",
            status=UserStatus.ACTIVE,
            is_platform_admin=True,
        )
        self.credential = UserCredential(
            user_id=USER_ID,
            password_hash=hash_password(password),
            failed_attempts=0,
        )
        self.created_digest: bytes | None = None
        self.one_time_tokens: dict[str, bytes] = {}
        self.commits = 0

    async def find_password_login(self, email: str) -> PasswordLoginRecord | None:
        if email != self.user.email:
            return None
        return PasswordLoginRecord(self.user, self.credential)

    async def record_failed_login(
        self, credential: UserCredential, *, locked_until: datetime | None
    ) -> None:
        credential.failed_attempts += 1
        credential.locked_until = locked_until

    async def record_successful_login(
        self, credential: UserCredential, updated_password_hash: str | None
    ) -> None:
        credential.failed_attempts = 0
        credential.locked_until = None
        if updated_password_hash:
            credential.password_hash = updated_password_hash

    async def find_user_by_email(self, normalized_email: str) -> User | None:
        return self.user if normalized_email == self.user.email else None

    async def find_user_by_id(self, user_id: UUID) -> User | None:
        return self.user if user_id == self.user.id else None

    async def create_session(self, **values: object) -> object:
        self.created_digest = values["digest"]  # type: ignore[assignment]
        return object()

    async def resolve_session(self, digest: bytes, now: datetime) -> User | None:
        del now
        return self.user if digest == self.created_digest else None

    async def revoke_session(self, digest: bytes, now: datetime) -> None:
        del now
        if digest == self.created_digest:
            self.created_digest = None

    async def create_one_time_token(self, **values: object) -> None:
        self.one_time_tokens[str(values["purpose"])] = values["digest"]  # type: ignore[assignment]

    async def consume_one_time_token(
        self, *, purpose: str, digest: bytes, now: datetime
    ) -> User | None:
        del now
        return self.user if self.one_time_tokens.pop(purpose, None) == digest else None

    async def mark_email_verified(self, user: User, now: datetime) -> None:
        user.email_verified_at = now

    async def replace_password(self, user: User, password_hash: str, now: datetime) -> None:
        del user, now
        self.credential.password_hash = password_hash
        self.created_digest = None

    async def commit(self) -> None:
        self.commits += 1


def auth_settings() -> Settings:
    return Settings(
        auth_token_secret=SecretStr("test-secret"),
        auth_max_failed_attempts=2,
        auth_lock_minutes=10,
    )


def test_password_hash_is_not_reversible_plaintext() -> None:
    encoded = hash_password("correct horse battery staple")

    assert encoded != "correct horse battery staple"
    assert verify_password("correct horse battery staple", encoded)[0]
    assert not verify_password("wrong password", encoded)[0]


def test_token_digest_is_keyed() -> None:
    assert token_digest("token", "first") != token_digest("token", "second")


def test_production_rejects_local_authentication_secret() -> None:
    with pytest.raises(ValueError, match="authentication secret"):
        Settings(
            environment="production", session_cookie_secure=True, public_base_url="https://x.test"
        )


@pytest.mark.asyncio
async def test_successful_login_creates_resolvable_session() -> None:
    repository = FakeRepository()
    service = AuthService(repository, auth_settings())  # type: ignore[arg-type]

    result = await service.login("OWNER@example.com", "correct horse battery staple", "pytest")
    principal = await service.authenticate_session(result.session_token)

    assert principal.user_id == USER_ID
    assert repository.created_digest is not None
    assert repository.commits == 1


@pytest.mark.asyncio
async def test_failed_logins_lock_account_without_disclosing_identity() -> None:
    repository = FakeRepository()
    service = AuthService(repository, auth_settings())  # type: ignore[arg-type]

    for _ in range(2):
        with pytest.raises(AuthenticationError, match="Invalid email or password"):
            await service.login("owner@example.com", "wrong password", None)

    assert repository.credential.failed_attempts == 2
    assert repository.credential.locked_until is not None


@pytest.mark.asyncio
async def test_password_reset_token_is_one_time_and_revokes_session() -> None:
    repository = FakeRepository()
    service = AuthService(repository, auth_settings())  # type: ignore[arg-type]
    await service.login("owner@example.com", "correct horse battery staple", "pytest")
    delivery = await service.issue_password_reset("OWNER@example.com")

    assert delivery is not None
    await service.reset_password(delivery[1], "new correct horse battery staple")
    assert repository.created_digest is None
    assert verify_password("new correct horse battery staple", repository.credential.password_hash)[
        0
    ]
    with pytest.raises(AuthenticationError):
        await service.reset_password(delivery[1], "another correct password")


@pytest.mark.asyncio
async def test_google_profile_requires_verified_email() -> None:
    token = {
        "userinfo": {
            "sub": "google-subject",
            "email": "owner@example.com",
            "email_verified": True,
            "name": "Owner",
        }
    }

    profile = await external_profile("google", object(), token)

    assert profile.subject == "google-subject"
    assert profile.email == "owner@example.com"


@pytest.mark.asyncio
async def test_github_profile_uses_primary_verified_email() -> None:
    class Response:
        def __init__(self, payload: object) -> None:
            self.payload = payload

        def json(self) -> object:
            return self.payload

    class Client:
        async def get(self, path: str, token: object) -> Response:
            del token
            if path == "user":
                return Response({"id": 123, "login": "owner", "email": None})
            return Response([{"email": "owner@example.com", "primary": True, "verified": True}])

    profile = await external_profile("github", Client(), {})

    assert profile.subject == "123"
    assert profile.email == "owner@example.com"


class FakeAuthService:
    async def login(self, email: str, password: str, user_agent: str | None) -> LoginResult:
        del email, password, user_agent
        return LoginResult(
            principal=Principal(USER_ID, "owner@example.com", "Owner", True),
            session_token="opaque-session-token",
        )

    async def authenticate_session(self, token: str | None) -> Principal:
        if token != "opaque-session-token":
            raise AuthenticationError("invalid_session", "Authentication required")
        return Principal(USER_ID, "owner@example.com", "Owner", True)

    async def logout(self, token: str | None) -> None:
        assert token == "opaque-session-token"


@pytest.fixture
def auth_client() -> TestClient:
    application = create_app()
    application.dependency_overrides[get_auth_service] = lambda: FakeAuthService()
    try:
        with TestClient(application) as client:
            yield client
    finally:
        application.dependency_overrides.pop(get_auth_service, None)


def test_login_sets_http_only_session_and_csrf_cookies(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/auth/login",
        json={"email": "owner@example.com", "password": "a-valid-password"},
    )

    assert response.status_code == 200
    cookies = response.headers.get_list("set-cookie")
    assert any("agent_factory_session=" in cookie and "HttpOnly" in cookie for cookie in cookies)
    assert any(
        "agent_factory_csrf=" in cookie and "SameSite=strict" in cookie for cookie in cookies
    )


def test_logout_requires_matching_csrf_token(auth_client: TestClient) -> None:
    auth_client.cookies.set("agent_factory_session", "opaque-session-token")
    auth_client.cookies.set("agent_factory_csrf", "csrf-token")

    rejected = auth_client.post("/api/auth/logout")
    accepted = auth_client.post("/api/auth/logout", headers={"X-CSRF-Token": "csrf-token"})

    assert rejected.status_code == 403
    assert accepted.status_code == 204


def test_unconfigured_oauth_provider_is_not_advertised(auth_client: TestClient) -> None:
    response = auth_client.get("/api/auth/providers")

    assert response.status_code == 200
    assert response.json() == {"providers": []}
