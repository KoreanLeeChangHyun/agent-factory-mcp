from copy import deepcopy

import pytest
from agent_factory_contracts import ContractValidationError, validate
from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE


def test_reference_documents_definition_is_valid() -> None:
    validate(DOCUMENTS_FIXTURE)


def test_external_url_in_component_props_is_rejected() -> None:
    definition = deepcopy(DOCUMENTS_FIXTURE)
    definition["panel"]["components"][0]["props"] = {"content": "https://example.invalid"}
    with pytest.raises(ContractValidationError):
        validate(definition)


def test_node_limit_is_enforced_before_schema_validation() -> None:
    with pytest.raises(ContractValidationError, match="node count"):
        validate([None] * 5001)
