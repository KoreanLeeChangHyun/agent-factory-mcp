from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.executions.agents.domain import AgentRun, RunStatus, transition_run
from agent_factory_core.shared.errors import ConflictError


def make_run(status: RunStatus) -> AgentRun:
    return AgentRun(uuid4(), uuid4(), uuid4(), uuid4(), uuid4(), "request-1", {}, status)


def test_run_transition_preserves_history_and_sets_terminal_time() -> None:
    now = datetime.now(UTC)
    value = transition_run(
        make_run(RunStatus.RUNNING),
        RunStatus.SUCCEEDED,
        now=now,
        output={"answer": 42},
        input_tokens=2,
        output_tokens=3,
    )
    assert value.status == RunStatus.SUCCEEDED
    assert value.finished_at == now
    assert value.output_payload == {"answer": 42}


def test_terminal_run_is_immutable() -> None:
    with pytest.raises(ConflictError, match="invalid_agent_run_transition"):
        transition_run(make_run(RunStatus.SUCCEEDED), RunStatus.RUNNING, now=datetime.now(UTC))
