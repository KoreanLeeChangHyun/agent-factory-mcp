from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from agent_factory_contracts import validate
from agent_factory_contracts.generated.models import WorkbenchDefinition

from .domain import WorkbenchActor, WorkbenchDefinitionAggregate, WorkbenchRelease
from .errors import WorkbenchNotFoundError, WorkbenchPermissionError
from .ports import WorkbenchDefinitionRepository, WorkbenchRepository


class GetReferenceWorkbench:
    """Return the validated Stage 4 standard Workbench definition."""

    def __init__(self, repository: WorkbenchDefinitionRepository) -> None:
        self._repository = repository

    def execute(self) -> WorkbenchDefinition:
        definition = self._repository.get_reference()
        validate(definition)
        return definition


def require(actor: WorkbenchActor, permission: str) -> None:
    if permission not in actor.permissions:
        raise WorkbenchPermissionError(permission)


class ListWorkbenchDefinitions:
    def __init__(self, repository: WorkbenchRepository) -> None:
        self.repository = repository

    async def execute(
        self, actor: WorkbenchActor, *, include_archived: bool = False
    ) -> Sequence[WorkbenchDefinitionAggregate]:
        require(actor, "workbench.read")
        return await self.repository.list_definitions(actor, include_archived=include_archived)


class GetWorkbenchDefinition:
    def __init__(self, repository: WorkbenchRepository) -> None:
        self.repository = repository

    async def execute(
        self, actor: WorkbenchActor, definition_id: UUID, *, preview: bool = False
    ) -> WorkbenchDefinitionAggregate:
        require(actor, "workbench.preview" if preview else "workbench.read")
        result = await self.repository.get_definition(actor, definition_id)
        if result is None:
            raise WorkbenchNotFoundError(str(definition_id))
        return result


class ListWorkbenchReleases:
    def __init__(self, repository: WorkbenchRepository) -> None:
        self.repository = repository

    async def execute(
        self, actor: WorkbenchActor, definition_id: UUID
    ) -> Sequence[WorkbenchRelease]:
        require(actor, "workbench.read")
        return await self.repository.list_releases(actor, definition_id)


class GetWorkbenchRelease:
    def __init__(self, repository: WorkbenchRepository) -> None:
        self.repository = repository

    async def execute(self, actor: WorkbenchActor, release_id: UUID) -> WorkbenchRelease:
        require(actor, "workbench.read")
        result = await self.repository.get_release(actor, release_id)
        if result is None:
            raise WorkbenchNotFoundError(str(release_id))
        return result
