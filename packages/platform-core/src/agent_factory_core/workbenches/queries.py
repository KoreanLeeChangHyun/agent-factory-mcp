from __future__ import annotations

from agent_factory_contracts import validate
from agent_factory_contracts.generated.models import WorkbenchDefinition

from .ports import WorkbenchDefinitionRepository


class GetReferenceWorkbench:
    def __init__(self, repository: WorkbenchDefinitionRepository) -> None:
        self._repository = repository

    def execute(self) -> WorkbenchDefinition:
        definition = self._repository.get_reference()
        validate(definition)
        return definition
