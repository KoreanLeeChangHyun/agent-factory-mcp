"""Registry for bounded, explicitly named background job handlers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

JobHandler = Callable[[dict[str, object]], Awaitable[dict[str, object]]]

_handlers: dict[str, JobHandler] = {}


class PermanentJobError(RuntimeError):
    """A validated failure that retrying cannot repair."""


def register_job_handler(task_type: str, handler: JobHandler) -> None:
    if task_type in _handlers:
        raise ValueError(f"job handler already registered: {task_type}")
    _handlers[task_type] = handler


def get_job_handler(task_type: str) -> JobHandler | None:
    return _handlers.get(task_type)


async def _noop(payload: dict[str, object]) -> dict[str, object]:
    return {"accepted": True, "payload": payload}


register_job_handler("system.noop", _noop)
