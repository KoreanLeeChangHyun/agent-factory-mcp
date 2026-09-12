from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID

from agent_factory_contracts.generated.models import WorkbenchDefinition

from .domain import (
    ValidatedWorkbench,
    WorkbenchActor,
    WorkbenchDefinitionAggregate,
    WorkbenchRelease,
)


class WorkbenchDefinitionRepository(Protocol):
    """Read the Stage 4 standard Workbench definition."""

    def get_reference(self) -> WorkbenchDefinition: ...


class WorkbenchValidator(Protocol):
    def validate(self, definition: Mapping[str, object]) -> ValidatedWorkbench: ...


class WorkbenchRepository(Protocol):
    async def list_definitions(
        self, actor: WorkbenchActor, *, include_archived: bool = False
    ) -> Sequence[WorkbenchDefinitionAggregate]: ...
    async def get_definition(
        self, actor: WorkbenchActor, definition_id: UUID, *, include_archived: bool = False
    ) -> WorkbenchDefinitionAggregate | None: ...
    async def create_definition(
        self, actor: WorkbenchActor, *, key: str, title: str, validated: ValidatedWorkbench
    ) -> WorkbenchDefinitionAggregate: ...
    async def update_definition(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        *,
        title: str,
        validated: ValidatedWorkbench,
        expected_revision: int,
    ) -> WorkbenchDefinitionAggregate: ...
    async def set_archived(
        self, actor: WorkbenchActor, definition_id: UUID, *, archived: bool, expected_revision: int
    ) -> WorkbenchDefinitionAggregate: ...
    async def publish(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        *,
        validated: ValidatedWorkbench,
        expected_revision: int,
        request_key: str,
        command_digest: str,
    ) -> WorkbenchRelease: ...
    async def list_releases(
        self, actor: WorkbenchActor, definition_id: UUID
    ) -> Sequence[WorkbenchRelease]: ...
    async def get_release(
        self, actor: WorkbenchActor, release_id: UUID
    ) -> WorkbenchRelease | None: ...
