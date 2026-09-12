"""PostgreSQL implementations of identity and authorization ports."""

import json
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from agent_factory_core.identity import (
    ApiTokenRecord,
    AuthorizationScope,
    AuthorizationService,
    AuthorizationState,
    CredentialRecord,
    PasswordLoginRecord,
    PermissionSource,
    Principal,
    ResolvedApiToken,
    SessionRecord,
    UserRecord,
    UserStatus,
)
from agent_factory_core.organizations.permissions import (
    ORGANIZATION_PERMISSIONS,
    WORKSPACE_PERMISSIONS,
)
from agent_factory_core.organizations.system_roles import ORGANIZATION_OWNER_ROLE_ID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _user(row: Any) -> UserRecord:
    data = row._mapping if hasattr(row, "_mapping") else row
    return UserRecord(
        id=data["id"],
        email=data["email"],
        display_name=data["display_name"],
        is_platform_admin=data["is_platform_admin"],
        status=UserStatus(data["status"]),
        email_verified_at=data.get("email_verified_at"),
    )


def _session(row: Any) -> SessionRecord:
    data = row._mapping if hasattr(row, "_mapping") else row
    return SessionRecord(
        id=data["id"],
        user_id=data["user_id"],
        created_at=data["created_at"],
        expires_at=data["expires_at"],
        revoked_at=data["revoked_at"],
        user_agent=data["user_agent"],
    )


def _api_token(row: Any) -> ApiTokenRecord:
    data = row._mapping if hasattr(row, "_mapping") else row
    return ApiTokenRecord(
        id=data["id"],
        user_id=data["user_id"],
        name=data["name"],
        scopes=tuple(data["scopes"] or ()),
        created_at=data["created_at"],
        expires_at=data["expires_at"],
        last_used_at=data["last_used_at"],
        revoked_at=data["revoked_at"],
    )


class PostgresIdentityRepository:
    """Uses the deployed tables directly without importing the legacy application."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def enable_identity_lookup(self) -> None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    _enable_identity_lookup = enable_identity_lookup

    async def find_password_login(self, normalized_email: str) -> PasswordLoginRecord | None:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT u.id, u.email, u.display_name, u.is_platform_admin, u.status,
                   u.email_verified_at, c.password_hash, c.failed_attempts, c.locked_until
              FROM users u JOIN user_credentials c ON c.user_id = u.id
             WHERE lower(u.email) = :email AND u.deleted_at IS NULL
        """),
                {"email": normalized_email},
            )
        ).first()
        if row is None:
            return None
        return PasswordLoginRecord(
            _user(row),
            CredentialRecord(row.id, row.password_hash, row.failed_attempts, row.locked_until),
        )

    async def find_user_by_email(self, normalized_email: str) -> UserRecord | None:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT id, email, display_name, is_platform_admin, status, email_verified_at
              FROM users WHERE lower(email) = :email AND deleted_at IS NULL
        """),
                {"email": normalized_email},
            )
        ).first()
        return _user(row) if row else None

    async def find_user_by_id(self, user_id: UUID) -> UserRecord | None:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT id, email, display_name, is_platform_admin, status, email_verified_at
              FROM users WHERE id = :user_id AND deleted_at IS NULL
        """),
                {"user_id": user_id},
            )
        ).first()
        return _user(row) if row else None

    async def record_failed_login(
        self, credential: CredentialRecord, *, locked_until: datetime | None
    ) -> None:
        await self.session.execute(
            text("""
            UPDATE user_credentials SET failed_attempts = failed_attempts + 1,
                   locked_until = :locked_until, updated_at = now() WHERE user_id = :user_id
        """),
            {"user_id": credential.user_id, "locked_until": locked_until},
        )

    async def record_successful_login(
        self, credential: CredentialRecord, updated_password_hash: str | None
    ) -> None:
        await self.session.execute(
            text("""
            UPDATE user_credentials SET failed_attempts = 0, locked_until = NULL,
                   password_hash = COALESCE(:password_hash, password_hash), updated_at = now()
             WHERE user_id = :user_id
        """),
            {"user_id": credential.user_id, "password_hash": updated_password_hash},
        )

    async def create_session(
        self, *, user_id: UUID, digest: bytes, expires_at: datetime, user_agent: str | None
    ) -> SessionRecord:
        row = (
            await self.session.execute(
                text("""
            INSERT INTO auth_sessions (id, user_id, token_digest, expires_at, user_agent)
            VALUES (:id, :user_id, :digest, :expires_at, :user_agent)
            RETURNING id, user_id, created_at, expires_at, revoked_at, user_agent
        """),
                {
                    "id": uuid4(),
                    "user_id": user_id,
                    "digest": digest,
                    "expires_at": expires_at,
                    "user_agent": (user_agent or "")[:500] or None,
                },
            )
        ).one()
        return _session(row)

    async def find_or_create_external_user(
        self, *, provider: str, subject: str, normalized_email: str, display_name: str
    ) -> UserRecord:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT u.id, u.email, u.display_name, u.is_platform_admin, u.status, u.email_verified_at
              FROM users u JOIN external_identities e ON e.user_id = u.id
             WHERE e.provider = :provider AND e.subject = :subject AND u.deleted_at IS NULL
        """),
                {"provider": provider, "subject": subject},
            )
        ).first()
        if row:
            return _user(row)
        user = await self.find_user_by_email(normalized_email)
        if user is None:
            user_id, organization_id = uuid4(), uuid4()
            row = (
                await self.session.execute(
                    text("""
                INSERT INTO users (id, email, display_name, email_verified_at)
                VALUES (:id, :email, :display_name, now())
                RETURNING id, email, display_name, is_platform_admin, status, email_verified_at
            """),
                    {"id": user_id, "email": normalized_email, "display_name": display_name[:200]},
                )
            ).one()
            user = _user(row)
            await self.session.execute(
                text("""
                INSERT INTO organizations (id, name, slug, is_personal)
                VALUES (:id, :name, :slug, true)
            """),
                {
                    "id": organization_id,
                    "name": f"{display_name[:180]} Personal",
                    "slug": f"personal-{user_id.hex[:12]}",
                },
            )
            await self.session.execute(
                text("""
                INSERT INTO organization_memberships (id, organization_id, user_id, role_id)
                VALUES (:id, :organization_id, :user_id, :role_id)
            """),
                {
                    "id": uuid4(),
                    "organization_id": organization_id,
                    "user_id": user_id,
                    "role_id": ORGANIZATION_OWNER_ROLE_ID,
                },
            )
        await self.session.execute(
            text("""
            INSERT INTO external_identities (id, user_id, provider, subject, email_at_provider)
            VALUES (:id, :user_id, :provider, :subject, :email)
        """),
            {
                "id": uuid4(),
                "user_id": user.id,
                "provider": provider,
                "subject": subject,
                "email": normalized_email,
            },
        )
        return user

    async def resolve_session(self, digest: bytes, now: datetime) -> UserRecord | None:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT u.id, u.email, u.display_name, u.is_platform_admin, u.status, u.email_verified_at
              FROM users u JOIN auth_sessions s ON s.user_id = u.id
             WHERE s.token_digest = :digest AND s.revoked_at IS NULL AND s.expires_at > :now
               AND u.deleted_at IS NULL
        """),
                {"digest": digest, "now": now},
            )
        ).first()
        if row:
            await self.session.execute(
                text("SELECT set_config('app.current_user_id', :value, true)"),
                {"value": str(row.id)},
            )
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', 'false', true)")
        )
        return _user(row) if row else None

    async def revoke_session(self, digest: bytes, now: datetime) -> None:
        await self.enable_identity_lookup()
        await self.session.execute(
            text(
                "UPDATE auth_sessions SET revoked_at=:now, updated_at=now() WHERE token_digest=:digest AND revoked_at IS NULL"
            ),
            {"now": now, "digest": digest},
        )

    async def list_sessions(self, user_id: UUID) -> list[SessionRecord]:
        rows = await self.session.execute(
            text(
                "SELECT id, user_id, created_at, expires_at, revoked_at, user_agent FROM auth_sessions WHERE user_id=:user_id ORDER BY created_at DESC"
            ),
            {"user_id": user_id},
        )
        return [_session(row) for row in rows]

    async def revoke_session_by_id(self, user_id: UUID, session_id: UUID, now: datetime) -> None:
        await self.session.execute(
            text(
                "UPDATE auth_sessions SET revoked_at=:now, updated_at=now() WHERE id=:id AND user_id=:user_id"
            ),
            {"now": now, "id": session_id, "user_id": user_id},
        )

    async def create_api_token(
        self,
        *,
        user_id: UUID,
        name: str,
        digest: bytes,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> ApiTokenRecord:
        row = (
            await self.session.execute(
                text("""
            INSERT INTO api_tokens (id, user_id, name, token_digest, scopes, expires_at)
            VALUES (:id, :user_id, :name, :digest, CAST(:scopes AS json), :expires_at)
            RETURNING id, user_id, name, scopes, created_at, expires_at, last_used_at, revoked_at
        """),
                {
                    "id": uuid4(),
                    "user_id": user_id,
                    "name": name,
                    "digest": digest,
                    "scopes": json.dumps(scopes),
                    "expires_at": expires_at,
                },
            )
        ).one()
        return _api_token(row)

    async def add_mcp_connection(
        self, *, user_id: UUID, organization_id: UUID, workspace_id: UUID, token_id: UUID, name: str
    ) -> None:
        await self.session.execute(
            text("""
            INSERT INTO mcp_connections (id, user_id, organization_id, workspace_id, token_id, name)
            VALUES (:id, :user_id, :organization_id, :workspace_id, :token_id, :name)
        """),
            {
                "id": uuid4(),
                "user_id": user_id,
                "organization_id": organization_id,
                "workspace_id": workspace_id,
                "token_id": token_id,
                "name": name,
            },
        )

    async def list_api_tokens(self, user_id: UUID) -> list[ApiTokenRecord]:
        rows = await self.session.execute(
            text(
                "SELECT id, user_id, name, scopes, created_at, expires_at, last_used_at, revoked_at FROM api_tokens WHERE user_id=:user_id ORDER BY created_at DESC"
            ),
            {"user_id": user_id},
        )
        return [_api_token(row) for row in rows]

    async def resolve_api_token(self, digest: bytes, now: datetime) -> ResolvedApiToken | None:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT u.id AS u_id, u.email, u.display_name, u.is_platform_admin, u.status,
                   u.email_verified_at, t.id AS t_id, t.user_id, t.name, t.scopes,
                   t.created_at, t.expires_at, t.last_used_at, t.revoked_at
              FROM users u JOIN api_tokens t ON t.user_id=u.id
             WHERE t.token_digest=:digest AND t.revoked_at IS NULL
               AND (t.expires_at IS NULL OR t.expires_at > :now) AND u.deleted_at IS NULL
        """),
                {"digest": digest, "now": now},
            )
        ).first()
        if row is None:
            return None
        await self.session.execute(
            text("UPDATE api_tokens SET last_used_at=:now, updated_at=now() WHERE id=:id"),
            {"now": now, "id": row.t_id},
        )
        await self.session.commit()
        user = UserRecord(
            row.u_id,
            row.email,
            row.display_name,
            row.is_platform_admin,
            UserStatus(row.status),
            row.email_verified_at,
        )
        token = ApiTokenRecord(
            row.t_id,
            row.user_id,
            row.name,
            tuple(row.scopes or ()),
            row.created_at,
            row.expires_at,
            now,
            row.revoked_at,
        )
        return ResolvedApiToken(user, token)

    async def revoke_api_token(self, user_id: UUID, token_id: UUID, now: datetime) -> None:
        await self.session.execute(
            text(
                "UPDATE api_tokens SET revoked_at=:now, updated_at=now() WHERE id=:id AND user_id=:user_id"
            ),
            {"now": now, "id": token_id, "user_id": user_id},
        )

    async def create_one_time_token(
        self, *, user_id: UUID, purpose: str, digest: bytes, expires_at: datetime
    ) -> None:
        await self.enable_identity_lookup()
        await self.session.execute(
            text(
                "INSERT INTO one_time_tokens (id, user_id, purpose, token_digest, expires_at) VALUES (:id, :user_id, :purpose, :digest, :expires_at)"
            ),
            {
                "id": uuid4(),
                "user_id": user_id,
                "purpose": purpose,
                "digest": digest,
                "expires_at": expires_at,
            },
        )

    async def consume_one_time_token(
        self, *, purpose: str, digest: bytes, now: datetime
    ) -> UserRecord | None:
        await self.enable_identity_lookup()
        row = (
            await self.session.execute(
                text("""
            SELECT t.id AS token_id, u.id, u.email, u.display_name, u.is_platform_admin,
                   u.status, u.email_verified_at
              FROM one_time_tokens t JOIN users u ON u.id=t.user_id
             WHERE t.purpose=:purpose AND t.token_digest=:digest AND t.consumed_at IS NULL
               AND t.expires_at > :now AND u.deleted_at IS NULL FOR UPDATE OF t
        """),
                {"purpose": purpose, "digest": digest, "now": now},
            )
        ).first()
        if row is None:
            return None
        await self.session.execute(
            text("UPDATE one_time_tokens SET consumed_at=:now, updated_at=now() WHERE id=:id"),
            {"now": now, "id": row.token_id},
        )
        return _user(row)

    async def mark_email_verified(self, user: UserRecord, now: datetime) -> None:
        await self.session.execute(
            text("UPDATE users SET email_verified_at=:now, updated_at=now() WHERE id=:id"),
            {"now": now, "id": user.id},
        )

    async def replace_password(self, user: UserRecord, password_hash: str, now: datetime) -> None:
        await self.session.execute(
            text("""
            INSERT INTO user_credentials (user_id, password_hash, password_changed_at)
            VALUES (:user_id, :password_hash, :now)
            ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,
              password_changed_at=EXCLUDED.password_changed_at, failed_attempts=0,
              locked_until=NULL, updated_at=now()
        """),
            {"user_id": user.id, "password_hash": password_hash, "now": now},
        )
        await self.session.execute(
            text(
                "UPDATE auth_sessions SET revoked_at=:now, updated_at=now() WHERE user_id=:user_id AND revoked_at IS NULL"
            ),
            {"now": now, "user_id": user.id},
        )

    async def commit(self) -> None:
        await self.session.commit()


class PostgresAuthorizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def establish_scope(self, principal: Principal, scope: AuthorizationScope) -> None:
        values = {
            "user_id": str(principal.user_id),
            "organization_id": str(scope.organization_id),
            "workspace_id": str(scope.workspace_id) if scope.workspace_id else "",
            "is_admin": "true" if principal.is_platform_admin else "false",
        }
        await self.session.execute(
            text("""
            SELECT set_config('app.current_user_id', :user_id, true),
                   set_config('app.current_organization_id', :organization_id, true),
                   set_config('app.current_workspace_id', :workspace_id, true),
                   set_config('app.is_platform_admin', :is_admin, true)
        """),
            values,
        )

    async def authorization_state(
        self, principal: Principal, scope: AuthorizationScope
    ) -> AuthorizationState:
        membership_status = await self.session.scalar(
            text("""
            SELECT m.status FROM organization_memberships m
              JOIN organizations o ON o.id=m.organization_id
             WHERE m.organization_id=:organization_id AND m.user_id=:user_id
               AND o.deleted_at IS NULL
        """).bindparams(organization_id=scope.organization_id, user_id=principal.user_id)
        )
        workspace_exists = True
        workspace_active = True
        if scope.workspace_id is not None:
            workspace_status = await self.session.scalar(
                text("""
                SELECT status FROM workspaces
                 WHERE id=:workspace_id AND organization_id=:organization_id
                   AND deleted_at IS NULL
            """).bindparams(workspace_id=scope.workspace_id, organization_id=scope.organization_id)
            )
            workspace_exists = workspace_status is not None
            workspace_active = workspace_status == "active"
        sources = await self._permission_sources(principal, scope)
        return AuthorizationState(
            organization_membership_active=membership_status == "active",
            workspace_exists=workspace_exists,
            workspace_active=workspace_active,
            sources=tuple(sources),
        )

    async def permission_sources(
        self, principal: Principal, scope: AuthorizationScope
    ) -> list[PermissionSource]:
        state = await self.authorization_state(principal, scope)
        if principal.is_platform_admin:
            return list(state.sources)
        return list(state.sources) if state.organization_membership_active else []

    async def _permission_sources(
        self, principal: Principal, scope: AuthorizationScope
    ) -> list[PermissionSource]:
        if principal.is_platform_admin:
            return [
                PermissionSource(
                    "platform", UUID(int=0), "Platform administrator", frozenset(), "platform"
                )
            ]
        expected_scope = "workspace" if scope.workspace_id else "organization"
        if scope.workspace_id is None:
            query = text("""
                SELECT 'organization' AS source, m.role_id, r.name AS role_name, NULL::uuid AS team_id, NULL::text AS team_name,
                       array_agg(rp.permission_key) AS permissions
                  FROM organization_memberships m JOIN roles r ON r.id=m.role_id
                  LEFT JOIN role_permissions rp ON rp.role_id=r.id
                 WHERE m.organization_id=:organization_id AND m.user_id=:user_id
                   AND r.scope='organization'
                   AND (r.organization_id IS NULL OR r.organization_id=:organization_id)
                 GROUP BY m.role_id, r.name
            """)
        else:
            query = text("""
                SELECT source, role_id, role_name, team_id, team_name, array_agg(permission_key) AS permissions
                FROM (
                    SELECT 'direct' AS source, wm.role_id, r.name AS role_name,
                           NULL::uuid AS team_id, NULL::text AS team_name, rp.permission_key
                      FROM workspace_memberships wm JOIN roles r ON r.id=wm.role_id
                      LEFT JOIN role_permissions rp ON rp.role_id=r.id
                     WHERE wm.workspace_id=:workspace_id AND wm.user_id=:user_id
                       AND r.scope='workspace' AND (r.organization_id IS NULL OR r.organization_id=:organization_id)
                    UNION ALL
                    SELECT 'team', g.role_id, r.name, t.id, t.name, rp.permission_key
                      FROM team_workspace_grants g JOIN organization_teams t ON t.id=g.team_id
                      JOIN team_memberships tm ON tm.team_id=t.id AND tm.organization_id=t.organization_id
                      JOIN roles r ON r.id=g.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.id
                     WHERE g.organization_id=:organization_id AND g.workspace_id=:workspace_id
                       AND tm.user_id=:user_id AND r.scope='workspace'
                       AND (r.organization_id IS NULL OR r.organization_id=:organization_id)
                ) grants GROUP BY source, role_id, role_name, team_id, team_name
            """)
        rows = await self.session.execute(
            query,
            {
                "organization_id": scope.organization_id,
                "workspace_id": scope.workspace_id,
                "user_id": principal.user_id,
            },
        )
        allowed = (
            WORKSPACE_PERMISSIONS if expected_scope == "workspace" else ORGANIZATION_PERMISSIONS
        )
        return [
            PermissionSource(
                row.source,
                row.role_id,
                row.role_name,
                frozenset(row.permissions or ()) & allowed,
                expected_scope,
                row.team_id,
                row.team_name,
            )
            for row in rows
        ]

    async def permission_keys(
        self, principal: Principal, scope: AuthorizationScope
    ) -> frozenset[str]:
        return (await AuthorizationService(self).resolve(principal, scope)).permissions
