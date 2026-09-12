from __future__ import annotations

from typing import Protocol

from agent_factory_contracts.generated.models import WorkbenchDefinition


class WorkbenchDefinitionRepository(Protocol):
    def get_reference(self) -> WorkbenchDefinition: ...
