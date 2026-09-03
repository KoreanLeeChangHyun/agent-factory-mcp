"""Cross-tenant administration queries under explicit platform context."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.tenant import TenantContext, apply_tenant_context
from app.modules.admin.models import FeatureFlag
from app.modules.auth.models import AuthSession
from app.modules.identity.models import User, UserStatus
from app.modules.integration.models import ConnectionStatus, IntegrationConnection
from app.modules.organization.models import Organization, OrganizationMembership
from app.modules.organization.system_roles import (
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from app.modules.schedule.models import Job, JobStatus
from app.modules.workspace.models import Workspace, WorkspaceMembership

ZERO_ID = UUID("00000000-0000-4000-8000-000000000000")


class AdminRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def establish_platform_context(self, user_id: UUID) -> None:
        await apply_tenant_context(
            self.session,
            TenantContext(user_id, ZERO_ID, None, is_platform_admin=True),
        )

    async def dashboard(self) -> dict[str, int]:
        models = {
            "users": User,
            "organizations": Organization,
            "workspaces": Workspace,
            "jobs": Job,
            "integrations": IntegrationConnection,
        }
        return {
            key: int(await self.session.scalar(select(func.count()).select_from(model)) or 0)
            for key, model in models.items()
        }

    async def list_users(self, limit: int = 200) -> list[User]:
        return list(
            await self.session.scalars(select(User).order_by(User.created_at.desc()).limit(limit))
        )

    async def set_user_status(self, user_id: UUID, status: UserStatus) -> User | None:
        return await self.session.scalar(
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(status=status, revision=User.revision + 1)
            .returning(User)
        )

    async def revoke_user_sessions(self, user_id: UUID) -> int:
        result = await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        return int(result.rowcount or 0)

    async def list_organizations(self) -> list[Organization]:
        return list(await self.session.scalars(select(Organization).order_by(Organization.name)))

    async def list_workspaces(self) -> list[Workspace]:
        return list(await self.session.scalars(select(Workspace).order_by(Workspace.name)))

    async def grant_organization_owner(self, organization_id: UUID, user_id: UUID) -> None:
        statement = insert(OrganizationMembership).values(
            organization_id=organization_id,
            user_id=user_id,
            role_id=ORGANIZATION_OWNER_ROLE_ID,
        )
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=[
                    OrganizationMembership.organization_id,
                    OrganizationMembership.user_id,
                ],
                set_={"role_id": ORGANIZATION_OWNER_ROLE_ID},
            )
        )

    async def grant_workspace_owner(self, workspace_id: UUID, user_id: UUID) -> None:
        statement = insert(WorkspaceMembership).values(
            workspace_id=workspace_id,
            user_id=user_id,
            role_id=WORKSPACE_OWNER_ROLE_ID,
        )
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=[
                    WorkspaceMembership.workspace_id,
                    WorkspaceMembership.user_id,
                ],
                set_={"role_id": WORKSPACE_OWNER_ROLE_ID},
            )
        )

    async def list_jobs(self, limit: int = 200) -> list[Job]:
        return list(
            await self.session.scalars(select(Job).order_by(Job.created_at.desc()).limit(limit))
        )

    async def set_job_status(self, job_id: UUID, status: JobStatus) -> Job | None:
        values: dict[str, object] = {"status": status}
        if status == JobStatus.CANCEL_REQUESTED:
            values["error_message"] = "Cancellation requested by platform administrator"
        return await self.session.scalar(
            update(Job).where(Job.id == job_id).values(**values).returning(Job)
        )

    async def requeue_job(self, job_id: UUID) -> Job | None:
        return await self.session.scalar(
            update(Job)
            .where(Job.id == job_id)
            .values(
                status=JobStatus.QUEUED,
                attempt_count=0,
                next_attempt_at=None,
                celery_task_id=None,
                started_at=None,
                finished_at=None,
                dead_lettered_at=None,
                error_code=None,
                error_message=None,
            )
            .returning(Job)
        )

    async def get_job(self, job_id: UUID) -> Job | None:
        return await self.session.scalar(select(Job).where(Job.id == job_id).with_for_update())

    async def list_integrations(self, limit: int = 200) -> list[IntegrationConnection]:
        return list(
            await self.session.scalars(
                select(IntegrationConnection)
                .order_by(IntegrationConnection.created_at.desc())
                .limit(limit)
            )
        )

    async def disconnect_integration(self, connection_id: UUID) -> IntegrationConnection | None:
        return await self.session.scalar(
            update(IntegrationConnection)
            .where(IntegrationConnection.id == connection_id)
            .values(
                status=ConnectionStatus.DISCONNECTED,
                encrypted_credentials=None,
                encryption_key_version=None,
                sync_cursor={},
                revision=IntegrationConnection.revision + 1,
            )
            .returning(IntegrationConnection)
        )

    async def list_flags(self) -> list[FeatureFlag]:
        return list(await self.session.scalars(select(FeatureFlag).order_by(FeatureFlag.key)))

    async def set_flag(
        self, key: str, enabled: bool, description: str, rules: dict[str, object]
    ) -> FeatureFlag:
        flag = await self.session.get(FeatureFlag, key)
        if flag is None:
            flag = FeatureFlag(key=key, is_enabled=enabled, description=description, rules=rules)
            self.session.add(flag)
        else:
            flag.is_enabled = enabled
            flag.description = description
            flag.rules = rules
        await self.session.flush()
        return flag

    async def migration_version(self) -> str | None:
        return await self.session.scalar(text("SELECT version_num FROM alembic_version"))

    async def commit(self) -> None:
        await self.session.commit()
