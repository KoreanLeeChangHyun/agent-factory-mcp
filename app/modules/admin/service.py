"""Platform administrator use cases."""

from importlib.metadata import PackageNotFoundError, version
from uuid import UUID

from app.common.errors import ConflictError, NotFoundError
from app.core.config import Settings
from app.modules.admin.models import FeatureFlag
from app.modules.admin.repository import AdminRepository
from app.modules.auth.service import Principal
from app.modules.identity.models import User, UserStatus
from app.modules.organization.models import Organization
from app.modules.schedule.models import Job, JobStatus
from app.modules.workspace.models import Workspace


class AdminService:
    def __init__(self, repository: AdminRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings
        self.principal: Principal | None = None

    async def establish(self, principal: Principal) -> None:
        self.principal = principal
        await self.repository.establish_platform_context(principal.user_id)

    async def dashboard(self) -> dict[str, int]:
        return await self.repository.dashboard()

    async def users(self) -> list[User]:
        return await self.repository.list_users()

    async def set_user_status(self, user_id: UUID, status: UserStatus) -> User:
        if self.principal and user_id == self.principal.user_id and status != UserStatus.ACTIVE:
            raise ConflictError("admin_self_lockout", "Administrator cannot suspend itself")
        user = await self.repository.set_user_status(user_id, status)
        if user is None:
            raise NotFoundError("user_not_found", "User not found")
        await self.repository.commit()
        return user

    async def revoke_sessions(self, user_id: UUID) -> int:
        count = await self.repository.revoke_user_sessions(user_id)
        await self.repository.commit()
        return count

    async def organizations(self) -> list[Organization]:
        return await self.repository.list_organizations()

    async def workspaces(self) -> list[Workspace]:
        return await self.repository.list_workspaces()

    async def grant_ownership(self, scope: str, resource_id: UUID, user_id: UUID) -> None:
        if scope == "organization":
            await self.repository.grant_organization_owner(resource_id, user_id)
        else:
            await self.repository.grant_workspace_owner(resource_id, user_id)
        await self.repository.commit()

    async def jobs(self) -> list[Job]:
        return await self.repository.list_jobs()

    async def cancel_job(self, job_id: UUID) -> Job:
        current = await self.repository.get_job(job_id)
        if current is None:
            raise NotFoundError("job_not_found", "Job not found")
        if current.status in {JobStatus.QUEUED, JobStatus.RETRY}:
            target = JobStatus.CANCELLED
        elif current.status == JobStatus.RUNNING:
            target = JobStatus.CANCEL_REQUESTED
        else:
            raise ConflictError("job_not_cancellable", "Job is not cancellable")
        job = await self.repository.set_job_status(job_id, target)
        if job is None:
            raise NotFoundError("job_not_found", "Job not found")
        await self.repository.commit()
        return job

    async def retry_job(self, job_id: UUID) -> Job:
        current = await self.repository.get_job(job_id)
        if current is None:
            raise NotFoundError("job_not_found", "Job not found")
        if current.status not in {JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED}:
            raise ConflictError("job_not_retryable", "Job is not retryable")
        job = await self.repository.requeue_job(job_id)
        assert job is not None
        await self.repository.commit()
        return job

    async def integrations(self) -> list[object]:
        return await self.repository.list_integrations()

    async def disconnect_integration(self, connection_id: UUID) -> object:
        connection = await self.repository.disconnect_integration(connection_id)
        if connection is None:
            raise NotFoundError(
                "integration_connection_not_found", "Integration connection not found"
            )
        await self.repository.commit()
        return connection

    async def flags(self) -> list[FeatureFlag]:
        return await self.repository.list_flags()

    async def set_flag(
        self, key: str, enabled: bool, description: str, rules: dict[str, object]
    ) -> FeatureFlag:
        flag = await self.repository.set_flag(key, enabled, description, rules)
        await self.repository.commit()
        return flag

    async def runtime_info(self) -> dict[str, object]:
        try:
            application_version = version("agent-factory-mcp")
        except PackageNotFoundError:
            application_version = "development"
        return {
            "application_version": application_version,
            "migration_version": await self.repository.migration_version(),
            "environment": self.settings.environment,
            "debug": self.settings.debug,
            "embedding_provider": self.settings.embedding_provider,
        }
