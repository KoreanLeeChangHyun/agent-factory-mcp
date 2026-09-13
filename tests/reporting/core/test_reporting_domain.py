from uuid import uuid4

import pytest
from agent_factory_core.executions.reporting.domain import (
    ReportStatus,
    RuntimeBinding,
    canonical_command_digest,
    require_runtime_binding,
    require_transition,
)
from agent_factory_core.shared.errors import ConflictError


def test_optional_null_binding_preserves_legacy_command_digest() -> None:
    identity = str(uuid4())
    old = {"key": "k", "operation": "task", "task": {"id": identity}}
    new = {
        **old,
        "heartbeat": None,
        "task": {"id": identity, "runtime_binding": None},
    }
    assert canonical_command_digest(old) == canonical_command_digest(new)


def test_binding_is_exact_and_terminal_reports_are_immutable() -> None:
    binding = RuntimeBinding("project", "agent", "session", "run")
    require_runtime_binding(binding, binding)
    with pytest.raises(ConflictError, match="report_runtime_binding_conflict"):
        require_runtime_binding(binding, None)
    with pytest.raises(ConflictError, match="invalid_transition"):
        require_transition(ReportStatus.COMPLETED, ReportStatus.IN_PROGRESS)
