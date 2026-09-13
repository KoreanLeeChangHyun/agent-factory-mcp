import pytest
from agent_factory_core.workbenches.errors import WorkbenchValidationError
from agent_factory_core.workbenches.policies import (
    RESERVED_STANDARD_WORKBENCH_IDS,
    require_customer_workbench_id,
)


@pytest.mark.parametrize(
    "identifier",
    ["organization", "workspaces", "documents", "account", "administration"],
)
def test_every_native_standard_identifier_is_server_reserved(identifier):
    definition = {"descriptor": {"id": identifier}}
    with pytest.raises(WorkbenchValidationError):
        require_customer_workbench_id("customer", definition)
    assert identifier in RESERVED_STANDARD_WORKBENCH_IDS
