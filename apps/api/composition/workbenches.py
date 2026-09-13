from agent_factory_adapters import ContractWorkbenchValidator, PostgresWorkbenchRepository
from agent_factory_core import (
    CreateWorkbenchDefinition,
    GetWorkbenchDefinition,
    GetWorkbenchRelease,
    ListWorkbenchDefinitions,
    ListWorkbenchReleases,
    PublishWorkbenchDefinition,
    SetWorkbenchArchived,
    UpdateWorkbenchDefinition,
)
from sqlalchemy.ext.asyncio import AsyncSession

from api.http.routes.workbenches import WorkbenchService


def build_workbench_service(
    session: AsyncSession, *, request_id: str | None = None, source: str = "http"
) -> WorkbenchService:
    repository = PostgresWorkbenchRepository(session, request_id=request_id, source=source)
    validator = ContractWorkbenchValidator()
    return WorkbenchService(
        list_definitions=ListWorkbenchDefinitions(repository),
        get_definition=GetWorkbenchDefinition(repository),
        create=CreateWorkbenchDefinition(repository, validator),
        update=UpdateWorkbenchDefinition(repository, validator),
        archive=SetWorkbenchArchived(repository),
        publish=PublishWorkbenchDefinition(repository, validator),
        list_releases=ListWorkbenchReleases(repository),
        get_release=GetWorkbenchRelease(repository),
    )
