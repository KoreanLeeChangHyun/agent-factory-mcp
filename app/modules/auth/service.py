"""Authentication use cases."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.common.errors import AuthenticationError
from app.core.config import Settings
from app.modules.auth.crypto import hash_password, new_opaque_token, token_digest, verify_password
from app.modules.auth.models import ApiToken, AuthSession
from app.modules.auth.repository import AuthRepository
from app.modules.identity.models import User, UserStatus
from app.modules.organization.permissions import WORKSPACE_PERMISSIONS, TOKEN_ALIASES, token_permissions


@dataclass(frozen=True, slots=True)
class Principal:
    user_id: UUID
    email: str
    display_name: str
    is_platform_admin: bool


@dataclass(frozen=True, slots=True)
class LoginResult:
    principal: Principal
    session_token: str


class AuthService:
    API_TOKEN_SCOPES = frozenset(key.replace(".", ":") for key in WORKSPACE_PERMISSIONS) | TOKEN_ALIASES.keys()

    def __init__(self, repository: AuthRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    def _digest(self, token: str) -> bytes:
        return token_digest(token, self.settings.auth_token_secret.get_secret_value())

    async def login(self, email: str, password: str, user_agent: str | None) -> LoginResult:
        now = datetime.now(UTC)
        record = await self.repository.find_password_login(email.strip().casefold())
        valid, updated_hash = verify_password(
            password, record.credential.password_hash if record else None
        )
        if record is None or not valid:
            if record is not None:
                next_attempt = record.credential.failed_attempts + 1
                locked_until = (
                    now + timedelta(minutes=self.settings.auth_lock_minutes)
                    if next_attempt >= self.settings.auth_max_failed_attempts
                    else None
                )
                await self.repository.record_failed_login(
                    record.credential, locked_until=locked_until
                )
                await self.repository.commit()
            raise AuthenticationError("invalid_credentials", "Invalid email or password")
        if record.credential.locked_until and record.credential.locked_until > now:
            raise AuthenticationError("account_locked", "Invalid email or password")
        if record.user.status is not UserStatus.ACTIVE:
            raise AuthenticationError("account_inactive", "Invalid email or password")

        token = new_opaque_token()
        expires_at = now + timedelta(hours=self.settings.auth_session_ttl_hours)
        await self.repository.record_successful_login(record.credential, updated_hash)
        await self.repository.create_session(
            user_id=record.user.id,
            digest=self._digest(token),
            expires_at=expires_at,
            user_agent=user_agent,
        )
        await self.repository.commit()
        return LoginResult(principal=_principal(record.user), session_token=token)

    async def authenticate_session(self, token: str | None) -> Principal:
        if not token:
            raise AuthenticationError("authentication_required", "Authentication required")
        user = await self.repository.resolve_session(self._digest(token), datetime.now(UTC))
        if user is None or user.status is not UserStatus.ACTIVE:
            raise AuthenticationError("invalid_session", "Authentication required")
        return _principal(user)

    async def login_external(
        self,
        *,
        provider: str,
        subject: str,
        email: str,
        display_name: str,
        user_agent: str | None,
    ) -> LoginResult:
        user = await self.repository.find_or_create_external_user(
            provider=provider,
            subject=subject,
            normalized_email=email.strip().casefold(),
            display_name=display_name.strip() or email,
        )
        token = new_opaque_token()
        await self.repository.create_session(
            user_id=user.id,
            digest=self._digest(token),
            expires_at=datetime.now(UTC) + timedelta(hours=self.settings.auth_session_ttl_hours),
            user_agent=user_agent,
        )
        await self.repository.commit()
        return LoginResult(principal=_principal(user), session_token=token)

    async def logout(self, token: str | None) -> None:
        if token:
            await self.repository.revoke_session(self._digest(token), datetime.now(UTC))
            await self.repository.commit()

    async def list_sessions(self, user_id: UUID) -> list[AuthSession]:
        return await self.repository.list_sessions(user_id)

    async def revoke_session(self, user_id: UUID, session_id: UUID) -> None:
        await self.repository.revoke_session_by_id(user_id, session_id, datetime.now(UTC))
        await self.repository.commit()

    async def create_api_token(
        self,
        *,
        user_id: UUID,
        name: str,
        scopes: list[str],
        expires_in_days: int | None,
        organization_id: UUID | None = None,
        workspace_id: UUID | None = None,
    ) -> tuple[ApiToken, str]:
        normalized_scopes = sorted(set(scopes))
        unsupported = set(normalized_scopes) - self.API_TOKEN_SCOPES
        if unsupported:
            raise AuthenticationError("unsupported_token_scope")
        if organization_id is None or workspace_id is None:
            raise AuthenticationError("token_workspace_required", "토큰을 적용할 조직과 작업공간을 선택하세요.")
        from app.modules.auth.authorization import AuthorizationRepository, AuthorizationScope, AuthorizationService
        user = await self.repository.find_user_by_id(user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise AuthenticationError("account_inactive")
        authorizer = AuthorizationService(AuthorizationRepository(self.repository.session))
        context = await authorizer.authorize(_principal(user), AuthorizationScope(organization_id, workspace_id), "token.create")
        if not token_permissions(normalized_scopes) <= context.permissions:
            from app.common.errors import PermissionDeniedError
            raise PermissionDeniedError("token_scope_exceeds_permissions", "보유한 권한 범위에서만 토큰을 발급할 수 있습니다.")
        plaintext = f"afm_{new_opaque_token()}"
        expires_at = (
            datetime.now(UTC) + timedelta(days=expires_in_days)
            if expires_in_days is not None
            else None
        )
        record = await self.repository.create_api_token(
            user_id=user_id,
            name=name.strip(),
            digest=self._digest(plaintext),
            scopes=normalized_scopes,
            expires_at=expires_at,
        )
        from app.modules.mcp_connection.models import MCPConnection
        self.repository.session.add(MCPConnection(user_id=user_id, organization_id=organization_id,
            workspace_id=workspace_id, token_id=record.id, name=name.strip()))
        await self.repository.commit()
        return record, plaintext

    async def list_api_tokens(self, user_id: UUID) -> list[ApiToken]:
        return await self.repository.list_api_tokens(user_id)

    async def revoke_api_token(self, user_id: UUID, token_id: UUID) -> None:
        await self.repository.revoke_api_token(user_id, token_id, datetime.now(UTC))
        await self.repository.commit()

    async def issue_email_verification(self, user_id: UUID) -> tuple[str, str]:
        user = await self.repository.find_user_by_id(user_id)
        if user is None:
            raise AuthenticationError("invalid_session", "Authentication required")
        token = await self._issue_one_time_token(user.id, "email_verification", minutes=60)
        return user.email, token

    async def verify_email(self, token: str) -> None:
        now = datetime.now(UTC)
        user = await self.repository.consume_one_time_token(
            purpose="email_verification", digest=self._digest(token), now=now
        )
        if user is None:
            raise AuthenticationError("invalid_or_expired_token")
        await self.repository.mark_email_verified(user, now)
        await self.repository.commit()

    async def issue_password_reset(self, email: str) -> tuple[str, str] | None:
        user = await self.repository.find_user_by_email(email.strip().casefold())
        if user is None or user.status is not UserStatus.ACTIVE:
            return None
        token = await self._issue_one_time_token(user.id, "password_reset", minutes=30)
        return user.email, token

    async def reset_password(self, token: str, password: str) -> None:
        now = datetime.now(UTC)
        user = await self.repository.consume_one_time_token(
            purpose="password_reset", digest=self._digest(token), now=now
        )
        if user is None:
            raise AuthenticationError("invalid_or_expired_token")
        await self.repository.replace_password(user, hash_password(password), now)
        await self.repository.commit()

    async def _issue_one_time_token(self, user_id: UUID, purpose: str, minutes: int) -> str:
        token = new_opaque_token()
        await self.repository.create_one_time_token(
            user_id=user_id,
            purpose=purpose,
            digest=self._digest(token),
            expires_at=datetime.now(UTC) + timedelta(minutes=minutes),
        )
        await self.repository.commit()
        return token


def _principal(user: User) -> Principal:
    return Principal(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_platform_admin=user.is_platform_admin,
    )
