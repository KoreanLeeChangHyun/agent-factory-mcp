"""Schedule calculation, queue routing, and retry policy tests."""

from datetime import UTC, datetime

import pytest

from app.common.errors import ApplicationError
from app.modules.schedule.service import calculate_next_run, retry_delay, validate_task_queue
from app.worker import tasks


def test_interval_schedule_has_minimum_and_exact_next_time() -> None:
    now = datetime(2026, 9, 4, 0, 0, tzinfo=UTC)

    assert calculate_next_run(now, None, 300, "UTC") == datetime(2026, 9, 4, 0, 5, tzinfo=UTC)
    with pytest.raises(ApplicationError, match="Minimum"):
        calculate_next_run(now, None, 30, "UTC")


def test_cron_schedule_respects_named_timezone() -> None:
    now = datetime(2026, 9, 3, 23, 30, tzinfo=UTC)

    next_run = calculate_next_run(now, "0 9 * * *", None, "Asia/Seoul")

    assert next_run == datetime(2026, 9, 4, 0, 0, tzinfo=UTC)


def test_retry_delay_is_exponential_and_bounded() -> None:
    assert [retry_delay(attempt, 30, 300) for attempt in range(1, 6)] == [
        30,
        60,
        120,
        240,
        300,
    ]


def test_task_types_are_pinned_to_bounded_queues() -> None:
    validate_task_queue("agent.run", "agents")
    with pytest.raises(ApplicationError, match="must use"):
        validate_task_queue("agent.run", "integrations")
    with pytest.raises(ApplicationError, match="Unsupported"):
        validate_task_queue("shell.arbitrary", "default")


def test_worker_task_disposes_loop_bound_database_engine(monkeypatch) -> None:
    events: list[str] = []

    async def operation() -> int:
        events.append("operation")
        return 3

    async def fake_dispose_engine() -> None:
        events.append("dispose")

    monkeypatch.setattr(tasks, "dispose_engine", fake_dispose_engine)

    assert tasks._run_task(operation()) == 3
    assert events == ["operation", "dispose"]
