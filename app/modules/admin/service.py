"""Compatibility translation bridge to target administration use cases."""

from typing import Mapping
from uuid import UUID

from agent_factory_api.composition.admin import AdminApplication, admin_application
from agent_factory_core.identity import Principal, UserStatus

from app.core.config import Settings
from app.modules.admin.repository import AdminRepository


class AdminService:
    def __init__(self, repository: AdminRepository, settings: Settings) -> None:
        self._application: AdminApplication = admin_application(
            repository.session,
            environment=settings.environment,
            debug=settings.debug,
            embedding_provider=settings.embedding_provider,
        )

    async def establish(self, principal: Principal) -> None:
        await self._application.establish(principal)

    async def dashboard(self) -> dict[str, int]:
        result = await self._application.dashboard()
        return {
            "users": result.users,
            "organizations": result.organizations,
            "workspaces": result.workspaces,
            "jobs": result.jobs,
            "integrations": result.integrations,
        }

    async def users(self) -> list[object]:
        return await self._application.users()

    async def set_user_status(
        self, user_id: UUID, status: object, expected_revision: int | None = None
    ) -> object:
        raw_status = getattr(status, "value", status)
        return await self._application.set_user_status(
            user_id, UserStatus(str(raw_status)), expected_revision
        )

    async def revoke_sessions(self, user_id: UUID) -> int:
        return await self._application.revoke_sessions(user_id)

    async def organizations(self) -> list[object]:
        return await self._application.list_organizations()

    async def workspaces(self) -> list[object]:
        return await self._application.list_workspaces()

    async def grant_ownership(self, scope: str, resource_id: UUID, user_id: UUID) -> None:
        await self._application.grant_ownership(scope, resource_id, user_id)

    async def jobs(self) -> list[object]:
        return await self._application.jobs()

    async def cancel_job(self, job_id: UUID) -> object:
        return await self._application.cancel_job(job_id)

    async def retry_job(self, job_id: UUID) -> object:
        return await self._application.retry_job(job_id)

    async def integrations(self) -> list[object]:
        return await self._application.integrations()

    async def disconnect_integration(self, connection_id: UUID) -> object:
        return await self._application.disconnect_integration(connection_id)

    async def flags(self) -> list[object]:
        return await self._application.flags()

    async def set_flag(
        self, key: str, enabled: bool, description: str, rules: Mapping[str, object]
    ) -> object:
        return await self._application.set_flag(key, enabled, description, rules)

    async def runtime_info(self) -> dict[str, object]:
        result = await self._application.runtime_info()
        return {
            "application_version": result.application_version,
            "migration_version": result.migration_version,
            "environment": result.environment,
            "debug": result.debug,
            "embedding_provider": result.embedding_provider,
        }

    async def audit_events(self) -> list[object]:
        return await self._application.audit_events()
