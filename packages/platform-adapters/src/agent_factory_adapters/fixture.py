from __future__ import annotations

from copy import deepcopy
from typing import cast

from agent_factory_contracts.generated.models import WorkbenchDefinition
from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE


class FixtureWorkbenchRepository:
    """Stage-1 adapter; persistent PostgreSQL implementation is intentionally later."""

    def get_reference(self) -> WorkbenchDefinition:
        return cast(WorkbenchDefinition, deepcopy(DOCUMENTS_FIXTURE))
