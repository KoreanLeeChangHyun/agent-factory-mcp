from datetime import UTC, datetime

import pytest
from agent_factory_core.executions.scheduling.domain import (
    calculate_next_run,
    retry_delay,
    validate_task_queue,
)
from agent_factory_core.shared.errors import ApplicationError


def test_schedule_calculation_and_queue_policy() -> None:
    now = datetime(2026, 9, 3, 23, 30, tzinfo=UTC)
    assert calculate_next_run(now, "0 9 * * *", None, "Asia/Seoul") == datetime(
        2026, 9, 4, 0, 0, tzinfo=UTC
    )
    assert calculate_next_run(now, None, 60, "UTC") == datetime(2026, 9, 3, 23, 31, tzinfo=UTC)
    assert retry_delay(5, 30, 300) == 300
    validate_task_queue("agent.run", "agents")
    with pytest.raises(ApplicationError, match="five-field"):
        calculate_next_run(now, "0 0 1 1 * 2027", None, "UTC")
    with pytest.raises(ApplicationError, match="must use"):
        validate_task_queue("agent.run", "default")
