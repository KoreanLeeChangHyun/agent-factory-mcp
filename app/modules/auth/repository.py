"""SQLAlchemy authentication repository."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Select, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import (
    ApiToken,
    AuthSession,
    ExternalIdentity,
    OneTimeToken,
    UserCredential,
)
from app.modules.identity.models import User
from app.modules.organization.models import Organization, OrganizationMembership
from app.modules.organization.system_roles import (
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from app.modules.workspace.models import Workspace, WorkspaceMembership


@dataclass(slots=True)
class PasswordLoginRecord:
    user: User
    credential: UserCredential


@dataclass(slots=True)
class ApiTokenRecord:
    user: User
    token: ApiToken


class AuthRepository:
    """Persistence operations that keep privileged identity lookup internal."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _enable_identity_lookup(self) -> None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    async def find_password_login(self, normalized_email: str) -> PasswordLoginRecord | None:
        await self._enable_identity_lookup()
        statement: Select[tuple[User, UserCredential]] = (
            select(User, UserCredential)
            .join(UserCredential, UserCredential.user_id == User.id)
            .where(func.lower(User.email) == normalized_email, User.deleted_at.is_(None))
        )
        row = (await self.session.execute(statement)).one_or_none()
        if row is None:
            return None
        return PasswordLoginRecord(user=row[0], credential=row[1])

    async def find_user_by_email(self, normalized_email: str) -> User | None:
        await self._enable_identity_lookup()
        return await self.session.scalar(
            select(User).where(
                func.lower(User.email) == normalized_email, User.deleted_at.is_(None)
            )
        )

    async def find_user_by_id(self, user_id: UUID) -> User | None:
        await self._enable_identity_lookup()
        return await self.session.get(User, user_id)

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
        if updated_password_hash is not None:
            credential.password_hash = updated_password_hash

    async def create_session(
        self,
        *,
        user_id: UUID,
        digest: bytes,
        expires_at: datetime,
        user_agent: str | None,
    ) -> AuthSession:
        auth_session = AuthSession(
            user_id=user_id,
            token_digest=digest,
            expires_at=expires_at,
            user_agent=(user_agent or "")[:500] or None,
        )
        self.session.add(auth_session)
        return auth_session

    async def find_or_create_external_user(
        self,
        *,
        provider: str,
        subject: str,
        normalized_email: str,
        display_name: str,
    ) -> User:
        """Resolve a verified provider identity or provision its personal tenant."""

        await self._enable_identity_lookup()
        existing = await self.session.scalar(
            select(User)
            .join(ExternalIdentity, ExternalIdentity.user_id == User.id)
            .where(
                ExternalIdentity.provider == provider,
                ExternalIdentity.subject == subject,
                User.deleted_at.is_(None),
            )
        )
        if existing is not None:
            return existing

        user = await self.session.scalar(
            select(User).where(
                func.lower(User.email) == normalized_email, User.deleted_at.is_(None)
            )
        )
        if user is None:
            user_id = uuid4()
            user = User(
                id=user_id,
                email=normalized_email,
                display_name=display_name[:200],
                email_verified_at=datetime.now(UTC),
            )
            organization = Organization(
                id=uuid4(),
                name=f"{display_name[:180]} Personal",
                slug=f"personal-{user_id.hex[:12]}",
                is_personal=True,
            )
            workspace = Workspace(
                id=uuid4(),
                organization_id=organization.id,
                name="Personal Workspace",
                slug="personal",
            )
            self.session.add_all(
                [
                    user,
                    organization,
                    workspace,
                    OrganizationMembership(
                        organization_id=organization.id,
                        user_id=user.id,
                        role_id=ORGANIZATION_OWNER_ROLE_ID,
                    ),
                    WorkspaceMembership(
                        workspace_id=workspace.id,
                        user_id=user.id,
                        role_id=WORKSPACE_OWNER_ROLE_ID,
                    ),
                ]
            )
        self.session.add(
            ExternalIdentity(
                user_id=user.id,
                provider=provider,
                subject=subject,
                email_at_provider=normalized_email,
            )
        )
        await self.session.flush()
        return user

    async def resolve_session(self, digest: bytes, now: datetime) -> User | None:
        await self._enable_identity_lookup()
        statement = (
            select(User)
            .join(AuthSession, AuthSession.user_id == User.id)
            .where(
                AuthSession.token_digest == digest,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > now,
                User.deleted_at.is_(None),
            )
        )
        user = (await self.session.execute(statement)).scalar_one_or_none()
        if user is not None:
            await self.session.execute(
                text("SELECT set_config('app.current_user_id', :user_id, true)"),
                {"user_id": str(user.id)},
            )
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', 'false', true)")
        )
        return user

    async def revoke_session(self, digest: bytes, now: datetime) -> None:
        await self._enable_identity_lookup()
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.token_digest == digest, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def list_sessions(self, user_id: UUID) -> list[AuthSession]:
        result = await self.session.scalars(
            select(AuthSession)
            .where(AuthSession.user_id == user_id)
            .order_by(AuthSession.created_at.desc())
        )
        return list(result)

    async def revoke_session_by_id(self, user_id: UUID, session_id: UUID, now: datetime) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.id == session_id, AuthSession.user_id == user_id)
            .values(revoked_at=now)
        )

    async def create_api_token(
        self,
        *,
        user_id: UUID,
        name: str,
        digest: bytes,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> ApiToken:
        record = ApiToken(
            user_id=user_id,
            name=name,
            token_digest=digest,
            scopes=scopes,
            expires_at=expires_at,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def list_api_tokens(self, user_id: UUID) -> list[ApiToken]:
        result = await self.session.scalars(
            select(ApiToken).where(ApiToken.user_id == user_id).order_by(ApiToken.created_at.desc())
        )
        return list(result)

    async def resolve_api_token(self, digest: bytes, now: datetime) -> ApiTokenRecord | None:
        await self._enable_identity_lookup()
        row = (
            await self.session.execute(
                select(User, ApiToken)
                .join(ApiToken, ApiToken.user_id == User.id)
                .where(
                    ApiToken.token_digest == digest,
                    ApiToken.revoked_at.is_(None),
                    (ApiToken.expires_at.is_(None) | (ApiToken.expires_at > now)),
                    User.deleted_at.is_(None),
                )
            )
        ).one_or_none()
        if row is None:
            return None
        row[1].last_used_at = now
        await self.session.commit()
        return ApiTokenRecord(row[0], row[1])

    async def revoke_api_token(self, user_id: UUID, token_id: UUID, now: datetime) -> None:
        await self.session.execute(
            update(ApiToken)
            .where(ApiToken.id == token_id, ApiToken.user_id == user_id)
            .values(revoked_at=now)
        )

    async def create_one_time_token(
        self,
        *,
        user_id: UUID,
        purpose: str,
        digest: bytes,
        expires_at: datetime,
    ) -> None:
        await self._enable_identity_lookup()
        self.session.add(
            OneTimeToken(
                user_id=user_id,
                purpose=purpose,
                token_digest=digest,
                expires_at=expires_at,
            )
        )

    async def consume_one_time_token(
        self, *, purpose: str, digest: bytes, now: datetime
    ) -> User | None:
        await self._enable_identity_lookup()
        statement = (
            select(OneTimeToken, User)
            .join(User, User.id == OneTimeToken.user_id)
            .where(
                OneTimeToken.purpose == purpose,
                OneTimeToken.token_digest == digest,
                OneTimeToken.consumed_at.is_(None),
                OneTimeToken.expires_at > now,
                User.deleted_at.is_(None),
            )
            .with_for_update()
        )
        row = (await self.session.execute(statement)).one_or_none()
        if row is None:
            return None
        row[0].consumed_at = now
        return row[1]

    async def mark_email_verified(self, user: User, now: datetime) -> None:
        user.email_verified_at = now

    async def replace_password(self, user: User, password_hash: str, now: datetime) -> None:
        credential = await self.session.get(UserCredential, user.id)
        if credential is None:
            credential = UserCredential(user_id=user.id, password_hash=password_hash)
            self.session.add(credential)
        else:
            credential.password_hash = password_hash
        credential.password_changed_at = now
        credential.failed_attempts = 0
        credential.locked_until = None
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def commit(self) -> None:
        await self.session.commit()
