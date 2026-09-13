from __future__ import annotations

from typing import Protocol

from agent_factory_core.executions.scheduling.domain import Job


class CeleryClient(Protocol):
    def send_task(
        self, name: str, *, args: list[str], queue: str, priority: int, countdown: int = 0
    ) -> object: ...


class CeleryJobPublisher:
    def __init__(
        self, client: CeleryClient, *, task_name: str = "agent_factory.execute_job"
    ) -> None:
        self.client = client
        self.task_name = task_name

    def publish(self, job: Job, *, countdown: int = 0) -> str:
        result = self.client.send_task(
            self.task_name,
            args=[str(job.id)],
            queue=job.queue,
            priority=job.priority,
            countdown=countdown,
        )
        task_id = getattr(result, "id", None)
        if not isinstance(task_id, str) or not task_id:
            raise RuntimeError("broker did not return a task id")
        return task_id
