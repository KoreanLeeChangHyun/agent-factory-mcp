from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from agent_factory_core.administration import Dashboard, FeatureFlag
from agent_factory_core.audit import AdminAuditEvent
from agent_factory_core.connections import AdminConnection
from agent_factory_core.executions import AdminJob, JobStatus
from agent_factory_core.identity import AdminUser, Principal, UserStatus
from agent_factory_core.organizations import AdminOrganization
from agent_factory_core.organizations.system_roles import (
    ORGANIZATION_MEMBER_ROLE_ID,
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from agent_factory_core.workspaces import AdminWorkspace
from sqlalchemy import text
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession


def _mapping(row: Row[Any]) -> Mapping[str, object]:
    return row._mapping


def _count(data: Mapping[str, object], key: str) -> int:
    value = data[key]
    if not isinstance(value, int):
        raise TypeError(f"database count {key!r} was not an integer")
    return value


class PostgresPlatformAdministrationRepository:
    """Concrete deployed-table adapter for typed administration ports."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def authorize_and_establish(self, principal: Principal) -> bool:
        await self._establish_revalidation_context(principal.user_id)
        authorized = bool(
            await self.session.scalar(
                text(
                    "SELECT EXISTS (SELECT 1 FROM users WHERE id = :user_id "
                    "AND status = 'active' AND deleted_at IS NULL AND is_platform_admin IS TRUE)"
                ),
                {"user_id": principal.user_id},
            )
        )
        if not authorized:
            return False
        for key, value in {
            "app.current_user_id": str(principal.user_id),
            "app.current_organization_id": "",
            "app.current_workspace_id": "",
            "app.is_platform_admin": "true",
        }.items():
            await self.session.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": value}
            )
        return True

    async def _establish_revalidation_context(self, user_id: UUID) -> None:
        for key, value in {
            # Keep only the authenticated identity visible through user-self RLS
            # until the deployed row independently confirms administrator status.
            "app.current_user_id": str(user_id),
            "app.current_organization_id": "",
            "app.current_workspace_id": "",
            "app.is_platform_admin": "false",
        }.items():
            await self.session.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": value}
            )

    async def dashboard(self) -> Dashboard:
        row = (
            await self.session.execute(
                text(
                    "SELECT (SELECT count(*) FROM users) AS users, "
                    "(SELECT count(*) FROM organizations) AS organizations, "
                    "(SELECT count(*) FROM workspaces) AS workspaces, "
                    "(SELECT count(*) FROM jobs) AS jobs, "
                    "(SELECT count(*) FROM integration_connections) AS integrations"
                )
            )
        ).one()
        data = _mapping(row)
        return Dashboard(
            users=_count(data, "users"),
            organizations=_count(data, "organizations"),
            workspaces=_count(data, "workspaces"),
            jobs=_count(data, "jobs"),
            integrations=_count(data, "integrations"),
        )

    async def list_users(self, *, limit: int) -> list[AdminUser]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, email, display_name, status, is_platform_admin, created_at, revision "
                    "FROM users ORDER BY created_at DESC, id LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [
            AdminUser(**{**dict(_mapping(row)), "status": UserStatus(str(_mapping(row)["status"]))})
            for row in rows
        ]

    async def set_user_status(
        self, *, user_id: UUID, status: UserStatus, expected_revision: int | None
    ) -> AdminUser | None:
        row = (
            await self.session.execute(
                text(
                    "UPDATE users SET status = :status, revision = revision + 1, "
                    "updated_at = now() WHERE id = :user_id AND deleted_at IS NULL "
                    "AND (CAST(:revision AS integer) IS NULL "
                    "OR revision = CAST(:revision AS integer)) "
                    "RETURNING id, email, display_name, status, is_platform_admin, created_at, revision"
                ),
                {"user_id": user_id, "status": status.value, "revision": expected_revision},
            )
        ).one_or_none()
        if row is None:
            return None
        data = dict(_mapping(row))
        data["status"] = UserStatus(str(data["status"]))
        return AdminUser(**data)

    async def revoke_sessions(self, *, user_id: UUID, revoked_at: datetime) -> int | None:
        exists = await self.session.scalar(
            text("SELECT EXISTS (SELECT 1 FROM users WHERE id = :user_id AND deleted_at IS NULL)"),
            {"user_id": user_id},
        )
        if not exists:
            return None
        result = await self.session.execute(
            text(
                "UPDATE auth_sessions SET revoked_at = :revoked_at "
                "WHERE user_id = :user_id AND revoked_at IS NULL"
            ),
            {"user_id": user_id, "revoked_at": revoked_at},
        )
        return int(result.rowcount or 0)

    async def list_organizations(self, *, limit: int) -> list[AdminOrganization]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, name, slug, is_personal, created_at FROM organizations "
                    "ORDER BY name, id LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [AdminOrganization(**dict(_mapping(row))) for row in rows]

    async def grant_owner(self, **values: UUID) -> bool:
        if "organization_id" in values:
            return await self._grant_organization_owner(
                values["organization_id"], values["user_id"]
            )
        return await self._grant_workspace_owner(values["workspace_id"], values["user_id"])

    async def _grant_organization_owner(self, organization_id: UUID, user_id: UUID) -> bool:
        valid = await self.session.scalar(
            text(
                "SELECT EXISTS (SELECT 1 FROM organizations o CROSS JOIN users u "
                "WHERE o.id = :resource_id AND o.deleted_at IS NULL "
                "AND u.id = :user_id AND u.deleted_at IS NULL AND u.status = 'active')"
            ),
            {"resource_id": organization_id, "user_id": user_id},
        )
        if not valid:
            return False
        await self.session.execute(
            text(
                "INSERT INTO organization_memberships "
                "(id, organization_id, user_id, role_id, status, created_at, updated_at) "
                "VALUES (:id, :organization_id, :user_id, :role_id, 'active', now(), now()) "
                "ON CONFLICT (organization_id, user_id) DO UPDATE SET "
                "role_id = EXCLUDED.role_id, status = 'active', updated_at = now()"
            ),
            {
                "id": uuid4(),
                "organization_id": organization_id,
                "user_id": user_id,
                "role_id": ORGANIZATION_OWNER_ROLE_ID,
            },
        )
        return True

    async def _grant_workspace_owner(self, workspace_id: UUID, user_id: UUID) -> bool:
        organization_id = await self.session.scalar(
            text(
                "SELECT w.organization_id FROM workspaces w "
                "JOIN organizations o ON o.id = w.organization_id CROSS JOIN users u "
                "WHERE w.id = :workspace_id AND w.deleted_at IS NULL AND w.status = 'active' "
                "AND o.deleted_at IS NULL AND u.id = :user_id AND u.deleted_at IS NULL "
                "AND u.status = 'active' FOR UPDATE OF w"
            ),
            {"workspace_id": workspace_id, "user_id": user_id},
        )
        if organization_id is None:
            return False
        await self.session.execute(
            text(
                "INSERT INTO organization_memberships "
                "(id, organization_id, user_id, role_id, status, created_at, updated_at) "
                "VALUES (:id, :organization_id, :user_id, :role_id, 'active', now(), now()) "
                "ON CONFLICT (organization_id, user_id) DO UPDATE SET "
                "status = 'active', updated_at = now()"
            ),
            {
                "id": uuid4(),
                "organization_id": organization_id,
                "user_id": user_id,
                "role_id": ORGANIZATION_MEMBER_ROLE_ID,
            },
        )
        await self.session.execute(
            text(
                "INSERT INTO workspace_memberships "
                "(id, workspace_id, user_id, role_id, created_at, updated_at) "
                "VALUES (:id, :workspace_id, :user_id, :role_id, now(), now()) "
                "ON CONFLICT (workspace_id, user_id) DO UPDATE SET "
                "role_id = EXCLUDED.role_id, updated_at = now()"
            ),
            {
                "id": uuid4(),
                "workspace_id": workspace_id,
                "user_id": user_id,
                "role_id": WORKSPACE_OWNER_ROLE_ID,
            },
        )
        return True

    async def list_workspaces(self, *, limit: int) -> list[AdminWorkspace]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, organization_id, name, slug, status, created_at FROM workspaces "
                    "ORDER BY name, id LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [AdminWorkspace(**dict(_mapping(row))) for row in rows]

    async def list_jobs(self, *, limit: int) -> list[AdminJob]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, organization_id, workspace_id, task_type, queue, status, "
                    "attempt_count, max_attempts, error_code, error_message, created_at FROM jobs "
                    "ORDER BY created_at DESC, id LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [self._job(row) for row in rows]

    async def transition_job(
        self, *, job_id: UUID, allowed: frozenset[JobStatus], target: JobStatus, retry: bool
    ) -> AdminJob | None:
        row = (
            await self.session.execute(
                text("SELECT status FROM jobs WHERE id = :job_id FOR UPDATE"),
                {"job_id": job_id},
            )
        ).one_or_none()
        if row is None or JobStatus(str(_mapping(row)["status"])) not in allowed:
            return None
        if retry:
            statement = text("""
                UPDATE jobs SET status = :status, attempt_count = 0,
                    next_attempt_at = NULL, celery_task_id = NULL, started_at = NULL,
                    finished_at = NULL, dead_lettered_at = NULL, error_code = NULL,
                    error_message = NULL
                WHERE id = :job_id
                RETURNING id, organization_id, workspace_id, task_type, queue, status,
                    attempt_count, max_attempts, error_code, error_message, created_at
            """)
        elif target is JobStatus.CANCEL_REQUESTED:
            statement = text("""
                UPDATE jobs SET status = :status,
                    error_message = 'Cancellation requested by platform administrator'
                WHERE id = :job_id
                RETURNING id, organization_id, workspace_id, task_type, queue, status,
                    attempt_count, max_attempts, error_code, error_message, created_at
            """)
        else:
            statement = text("""
                UPDATE jobs SET status = :status
                WHERE id = :job_id
                RETURNING id, organization_id, workspace_id, task_type, queue, status,
                    attempt_count, max_attempts, error_code, error_message, created_at
            """)
        updated = (
            await self.session.execute(
                statement,
                {"job_id": job_id, "status": target.value},
            )
        ).one()
        sequence = int(
            await self.session.scalar(
                text(
                    "SELECT COALESCE(max(sequence), 0) + 1 FROM job_events WHERE job_id = :job_id"
                ),
                {"job_id": job_id},
            )
            or 1
        )
        await self.session.execute(
            text(
                "INSERT INTO job_events (id, workspace_id, job_id, sequence, event_type, payload, "
                "created_at, updated_at) VALUES (:id, :workspace_id, :job_id, :sequence, "
                ":event_type, CAST(:payload AS json), now(), now())"
            ),
            {
                "id": uuid4(),
                "workspace_id": _mapping(updated)["workspace_id"],
                "job_id": job_id,
                "sequence": sequence,
                "event_type": "job.retried" if retry else f"job.{target.value}",
                "payload": "{}",
            },
        )
        return self._job(updated)

    async def job_exists(self, job_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text("SELECT EXISTS (SELECT 1 FROM jobs WHERE id = :job_id)"), {"job_id": job_id}
            )
        )

    @staticmethod
    def _job(row: object) -> AdminJob:
        data = dict(_mapping(row))
        data["status"] = JobStatus(str(data["status"]))
        return AdminJob(**data)

    async def list_connections(self, *, limit: int) -> list[AdminConnection]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, workspace_id, provider_id, name, status, last_error_code, created_at "
                    "FROM integration_connections ORDER BY created_at DESC, id LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [AdminConnection(**dict(_mapping(row))) for row in rows]

    async def disconnect(self, connection_id: UUID) -> AdminConnection | None:
        row = (
            await self.session.execute(
                text(
                    "UPDATE integration_connections SET status = 'disconnected', "
                    "encrypted_credentials = NULL, encryption_key_version = NULL, sync_cursor = '{}', "
                    "revision = revision + 1, updated_at = now() WHERE id = :connection_id "
                    "RETURNING id, workspace_id, provider_id, name, status, "
                    "last_error_code, created_at"
                ),
                {"connection_id": connection_id},
            )
        ).one_or_none()
        return None if row is None else AdminConnection(**dict(_mapping(row)))

    async def list_flags(self, *, limit: int) -> list[FeatureFlag]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT key, is_enabled, description, rules, updated_at FROM feature_flags "
                    "ORDER BY key LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [FeatureFlag(**dict(_mapping(row))) for row in rows]

    async def read_flag(self, key: str) -> FeatureFlag | None:
        row = (
            await self.session.execute(
                text(
                    "SELECT key, is_enabled, description, rules, updated_at "
                    "FROM feature_flags WHERE key = :key"
                ),
                {"key": key},
            )
        ).one_or_none()
        return None if row is None else FeatureFlag(**dict(_mapping(row)))

    async def set_flag(
        self, *, key: str, enabled: bool, description: str, rules: Mapping[str, object]
    ) -> FeatureFlag:
        row = (
            await self.session.execute(
                text(
                    "INSERT INTO feature_flags "
                    "(key, is_enabled, description, rules, created_at, updated_at) "
                    "VALUES (:key, :enabled, :description, CAST(:rules AS json), now(), now()) "
                    "ON CONFLICT (key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, "
                    "description = EXCLUDED.description, rules = EXCLUDED.rules, updated_at = now() "
                    "RETURNING key, is_enabled, description, rules, updated_at"
                ),
                {
                    "key": key,
                    "enabled": enabled,
                    "description": description,
                    "rules": json.dumps(dict(rules)),
                },
            )
        ).one()
        return FeatureFlag(**dict(_mapping(row)))

    async def migration_version(self) -> str | None:
        return await self.session.scalar(text("SELECT version_num FROM alembic_version"))

    async def list_events(self, *, limit: int) -> list[AdminAuditEvent]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, occurred_at, actor_user_id, organization_id, workspace_id, action, "
                    "target_type, target_id, outcome, request_id, source, event_metadata "
                    "FROM audit_events ORDER BY occurred_at DESC, id LIMIT :limit"
                ),
                {"limit": limit},
            )
        ).all()
        return [AdminAuditEvent(**dict(_mapping(row))) for row in rows]

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
