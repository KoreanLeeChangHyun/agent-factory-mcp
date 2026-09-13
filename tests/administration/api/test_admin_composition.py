from api.composition.admin import AdminApplication, AdminRuntimeSettings
from agent_factory_core.administration import PlatformAdministration
from agent_factory_core.audit import AuditAdministration
from agent_factory_core.connections import ConnectionAdministration
from agent_factory_core.executions import ExecutionAdministration
from agent_factory_core.identity import IdentityAdministration
from agent_factory_core.organizations import OrganizationAdministration
from agent_factory_core.workspaces import WorkspaceAdministration
from sqlalchemy.ext.asyncio import AsyncSession


def test_admin_composition_uses_domain_owned_use_cases() -> None:
    application = AdminApplication(
        AsyncSession(),
        AdminRuntimeSettings(
            application_version="test",
            environment="test",
            debug=False,
            embedding_provider="disabled",
        ),
    )

    assert isinstance(application.platform, PlatformAdministration)
    assert isinstance(application.identity, IdentityAdministration)
    assert isinstance(application.organizations, OrganizationAdministration)
    assert isinstance(application.workspaces, WorkspaceAdministration)
    assert isinstance(application.executions, ExecutionAdministration)
    assert isinstance(application.connections, ConnectionAdministration)
    assert isinstance(application.audit, AuditAdministration)
