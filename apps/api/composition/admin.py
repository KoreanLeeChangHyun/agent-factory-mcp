from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from uuid import UUID

from agent_factory_adapters.identity import SystemClock
from agent_factory_adapters.postgres import PostgresPlatformAdministrationRepository
from agent_factory_core.administration import PlatformAdministration, react_workbench_enabled
from agent_factory_core.audit import AuditAdministration
from agent_factory_core.connections import ConnectionAdministration
from agent_factory_core.executions import ExecutionAdministration
from agent_factory_core.identity import IdentityAdministration, Principal, UserStatus
from agent_factory_core.organizations import OrganizationAdministration
from agent_factory_core.workspaces import WorkspaceAdministration
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class AdminRuntimeSettings:
    application_version: str
    environment: str
    debug: bool
    embedding_provider: str


def runtime_settings(
    *, environment: str, debug: bool, embedding_provider: str
) -> AdminRuntimeSettings:
    try:
        application_version = version("agent-factory-mcp")
    except PackageNotFoundError:
        application_version = "development"
    return AdminRuntimeSettings(
        application_version=application_version,
        environment=environment,
        debug=debug,
        embedding_provider=embedding_provider,
    )


class AdminApplication:
    """Typed orchestration across the domain-owned administration use cases."""

    def __init__(self, session: AsyncSession, runtime: AdminRuntimeSettings) -> None:
        repository = PostgresPlatformAdministrationRepository(session)
        self.platform = PlatformAdministration(repository, runtime)
        self.identity = IdentityAdministration(repository, SystemClock())
        self.organizations = OrganizationAdministration(repository)
        self.workspaces = WorkspaceAdministration(repository)
        self.executions = ExecutionAdministration(repository)
        self.connections = ConnectionAdministration(repository)
        self.audit = AuditAdministration(repository)

    async def establish(self, principal: Principal) -> None:
        await self.platform.establish(principal)

    @property
    def principal(self) -> Principal:
        return self.platform.require_established()

    async def dashboard(self) -> object:
        return await self.platform.dashboard()

    async def users(self) -> list[object]:
        _ = self.principal
        return list(await self.identity.users())

    async def set_user_status(
        self, user_id: UUID, status: UserStatus, expected_revision: int | None = None
    ) -> object:
        return await self.identity.set_user_status(
            self.principal, user_id, status, expected_revision
        )

    async def revoke_sessions(self, user_id: UUID) -> int:
        _ = self.principal
        return await self.identity.revoke_sessions(user_id)

    async def list_organizations(self) -> list[object]:
        _ = self.principal
        return list(await self.organizations.organizations())

    async def list_workspaces(self) -> list[object]:
        _ = self.principal
        return list(await self.workspaces.workspaces())

    async def grant_ownership(self, scope: str, resource_id: UUID, user_id: UUID) -> None:
        _ = self.principal
        if scope == "organization":
            await self.organizations.grant_owner(resource_id, user_id)
        else:
            await self.workspaces.grant_owner(resource_id, user_id)

    async def jobs(self) -> list[object]:
        _ = self.principal
        return list(await self.executions.jobs())

    async def cancel_job(self, job_id: UUID) -> object:
        _ = self.principal
        return await self.executions.cancel(job_id)

    async def retry_job(self, job_id: UUID) -> object:
        _ = self.principal
        return await self.executions.retry(job_id)

    async def integrations(self) -> list[object]:
        _ = self.principal
        return list(await self.connections.connections())

    async def disconnect_integration(self, connection_id: UUID) -> object:
        _ = self.principal
        return await self.connections.disconnect(connection_id)

    async def flags(self) -> list[object]:
        return list(await self.platform.flags())

    async def set_flag(
        self, key: str, enabled: bool, description: str, rules: Mapping[str, object]
    ) -> object:
        return await self.platform.set_flag(key, enabled, description, rules)

    async def runtime_info(self) -> object:
        return await self.platform.runtime_info()

    async def audit_events(self) -> list[object]:
        _ = self.principal
        return list(await self.audit.events())


def admin_application(
    session: AsyncSession, *, environment: str, debug: bool, embedding_provider: str
) -> AdminApplication:
    return AdminApplication(
        session,
        runtime_settings(
            environment=environment, debug=debug, embedding_provider=embedding_provider
        ),
    )


async def react_workbench_rollout(
    session: AsyncSession, *, organization_id: UUID, workspace_id: UUID
) -> bool:
    repository = PostgresPlatformAdministrationRepository(session)
    flag = await repository.read_flag("react-workbench")
    return flag is not None and react_workbench_enabled(
        is_enabled=flag.is_enabled,
        rules=flag.rules,
        organization_id=organization_id,
        workspace_id=workspace_id,
    )
