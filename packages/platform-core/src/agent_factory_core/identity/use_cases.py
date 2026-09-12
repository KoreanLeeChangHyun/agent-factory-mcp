"""Identity lifecycle decisions independent of frameworks and persistence."""

from collections.abc import Callable
from datetime import timedelta
from typing import Any
from uuid import UUID

from agent_factory_core.organizations.permissions import (
    TOKEN_ALIASES,
    WORKSPACE_PERMISSIONS,
    token_permissions,
)
from agent_factory_core.shared.errors import AuthenticationError, PermissionDeniedError

from .authorization import AuthorizationScope, AuthorizationService
from .domain import ApiTokenRecord, LoginResult, Principal, SessionRecord, UserStatus
from .ports import Clock, IdentityCrypto, IdentityRepository
from .settings import IdentitySettings

AuthorizationFactory = Callable[[], AuthorizationService]


class AuthService:
    API_TOKEN_SCOPES = (
        frozenset(key.replace(".", ":") for key in WORKSPACE_PERMISSIONS) | TOKEN_ALIASES.keys()
    )

    def __init__(
        self,
        repository: IdentityRepository,
        settings: IdentitySettings,
        clock: Clock,
        crypto: IdentityCrypto,
        authorization_factory: AuthorizationFactory | None = None,
    ) -> None:
        self.repository = repository
        self.settings = settings
        self.clock = clock
        self.crypto = crypto
        self.authorization_factory = authorization_factory

    async def login(self, email: str, password: str, user_agent: str | None) -> LoginResult:
        now = self.clock.now()
        record = await self.repository.find_password_login(email.strip().casefold())
        credential = record.credential if record else None
        valid, updated_hash = self.crypto.verify_password(
            password, credential.password_hash if credential else None
        )
        if record is None or not valid:
            if credential is not None:
                next_attempt = credential.failed_attempts + 1
                locked_until = (
                    now + timedelta(minutes=self.settings.lock_minutes)
                    if next_attempt >= self.settings.max_failed_attempts
                    else None
                )
                await self.repository.record_failed_login(credential, locked_until=locked_until)
                await self.repository.commit()
            raise AuthenticationError("invalid_credentials", "Invalid email or password")
        if credential.locked_until and credential.locked_until > now:
            raise AuthenticationError("account_locked", "Invalid email or password")
        if _status(record.user) is not UserStatus.ACTIVE:
            raise AuthenticationError("account_inactive", "Invalid email or password")
        token = self.crypto.new_opaque_token()
        await self.repository.record_successful_login(credential, updated_hash)
        await self.repository.create_session(
            user_id=record.user.id,
            digest=self.crypto.token_digest(token),
            expires_at=now + timedelta(hours=self.settings.session_ttl_hours),
            user_agent=user_agent,
        )
        await self.repository.commit()
        return LoginResult(_principal(record.user), token)

    async def authenticate_session(self, token: str | None) -> Principal:
        if not token:
            raise AuthenticationError("authentication_required", "Authentication required")
        user = await self.repository.resolve_session(
            self.crypto.token_digest(token), self.clock.now()
        )
        if user is None or _status(user) is not UserStatus.ACTIVE:
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
        if _status(user) is not UserStatus.ACTIVE:
            raise AuthenticationError("account_inactive", "Invalid email or password")
        token = self.crypto.new_opaque_token()
        await self.repository.create_session(
            user_id=user.id,
            digest=self.crypto.token_digest(token),
            expires_at=self.clock.now() + timedelta(hours=self.settings.session_ttl_hours),
            user_agent=user_agent,
        )
        await self.repository.commit()
        return LoginResult(_principal(user), token)

    async def logout(self, token: str | None) -> None:
        if token:
            await self.repository.revoke_session(self.crypto.token_digest(token), self.clock.now())
            await self.repository.commit()

    async def list_sessions(self, user_id: UUID) -> list[SessionRecord]:
        return await self.repository.list_sessions(user_id)

    async def revoke_session(self, user_id: UUID, session_id: UUID) -> None:
        await self.repository.revoke_session_by_id(user_id, session_id, self.clock.now())
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
    ) -> tuple[ApiTokenRecord, str]:
        normalized_scopes = sorted(set(scopes))
        if set(normalized_scopes) - self.API_TOKEN_SCOPES:
            raise AuthenticationError("unsupported_token_scope")
        if organization_id is None or workspace_id is None:
            raise AuthenticationError(
                "token_workspace_required", "토큰을 적용할 조직과 작업공간을 선택하세요."
            )
        user = await self.repository.find_user_by_id(user_id)
        if user is None or _status(user) is not UserStatus.ACTIVE:
            raise AuthenticationError("account_inactive")
        if self.authorization_factory is None:
            raise RuntimeError("Authorization service is required for API token creation")
        context = await self.authorization_factory().authorize(
            _principal(user), AuthorizationScope(organization_id, workspace_id), "token.create"
        )
        if not token_permissions(normalized_scopes) <= context.permissions:
            raise PermissionDeniedError(
                "token_scope_exceeds_permissions",
                "보유한 권한 범위에서만 토큰을 발급할 수 있습니다.",
            )
        plaintext = f"afm_{self.crypto.new_opaque_token()}"
        expires_at = (
            self.clock.now() + timedelta(days=expires_in_days)
            if expires_in_days is not None
            else None
        )
        record = await self.repository.create_api_token(
            user_id=user_id,
            name=name.strip(),
            digest=self.crypto.token_digest(plaintext),
            scopes=normalized_scopes,
            expires_at=expires_at,
        )
        await self.repository.add_mcp_connection(
            user_id=user_id,
            organization_id=organization_id,
            workspace_id=workspace_id,
            token_id=record.id,
            name=name.strip(),
        )
        await self.repository.commit()
        return record, plaintext

    async def list_api_tokens(self, user_id: UUID) -> list[ApiTokenRecord]:
        return await self.repository.list_api_tokens(user_id)

    async def revoke_api_token(self, user_id: UUID, token_id: UUID) -> None:
        await self.repository.revoke_api_token(user_id, token_id, self.clock.now())
        await self.repository.commit()

    async def issue_email_verification(self, user_id: UUID) -> tuple[str, str]:
        user = await self.repository.find_user_by_id(user_id)
        if user is None:
            raise AuthenticationError("invalid_session", "Authentication required")
        return user.email, await self._issue_one_time_token(user.id, "email_verification", 60)

    async def verify_email(self, token: str) -> None:
        now = self.clock.now()
        user = await self.repository.consume_one_time_token(
            purpose="email_verification", digest=self.crypto.token_digest(token), now=now
        )
        if user is None:
            raise AuthenticationError("invalid_or_expired_token")
        await self.repository.mark_email_verified(user, now)
        await self.repository.commit()

    async def issue_password_reset(self, email: str) -> tuple[str, str] | None:
        user = await self.repository.find_user_by_email(email.strip().casefold())
        if user is None or _status(user) is not UserStatus.ACTIVE:
            return None
        return user.email, await self._issue_one_time_token(user.id, "password_reset", 30)

    async def reset_password(self, token: str, password: str) -> None:
        now = self.clock.now()
        user = await self.repository.consume_one_time_token(
            purpose="password_reset", digest=self.crypto.token_digest(token), now=now
        )
        if user is None:
            raise AuthenticationError("invalid_or_expired_token")
        await self.repository.replace_password(user, self.crypto.hash_password(password), now)
        await self.repository.commit()

    async def _issue_one_time_token(self, user_id: UUID, purpose: str, minutes: int) -> str:
        token = self.crypto.new_opaque_token()
        await self.repository.create_one_time_token(
            user_id=user_id,
            purpose=purpose,
            digest=self.crypto.token_digest(token),
            expires_at=self.clock.now() + timedelta(minutes=minutes),
        )
        await self.repository.commit()
        return token


def _status(user: Any) -> UserStatus:
    value = user.status
    return value if isinstance(value, UserStatus) else UserStatus(str(value))


def _principal(user: Any) -> Principal:
    return Principal(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_platform_admin=user.is_platform_admin,
    )
