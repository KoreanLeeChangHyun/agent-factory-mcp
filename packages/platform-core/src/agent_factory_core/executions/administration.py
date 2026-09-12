from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID

from agent_factory_core.shared.errors import ConflictError, NotFoundError


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY = "retry"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELLED = "cancelled"
    DEAD = "dead"


@dataclass(frozen=True, slots=True)
class AdminJob:
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    task_type: str
    queue: str
    status: JobStatus
    attempt_count: int
    max_attempts: int
    error_code: str | None
    error_message: str | None
    created_at: datetime


class ExecutionAdministrationRepository(Protocol):
    async def list_jobs(self, *, limit: int) -> list[AdminJob]: ...
    async def transition_job(
        self, *, job_id: UUID, allowed: frozenset[JobStatus], target: JobStatus, retry: bool
    ) -> AdminJob | None: ...
    async def job_exists(self, job_id: UUID) -> bool: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class ExecutionAdministration:
    def __init__(self, repository: ExecutionAdministrationRepository) -> None:
        self._repository = repository

    async def jobs(self) -> list[AdminJob]:
        return await self._repository.list_jobs(limit=200)

    async def cancel(self, job_id: UUID) -> AdminJob:
        # One conditional row-locked adapter operation prevents a worker transition
        # from being overwritten between inspection and update.
        result = await self._repository.transition_job(
            job_id=job_id,
            allowed=frozenset({JobStatus.QUEUED, JobStatus.RETRY}),
            target=JobStatus.CANCELLED,
            retry=False,
        )
        if result is None:
            result = await self._repository.transition_job(
                job_id=job_id,
                allowed=frozenset({JobStatus.RUNNING}),
                target=JobStatus.CANCEL_REQUESTED,
                retry=False,
            )
        return await self._finish_transition(job_id, result, "job_not_cancellable")

    async def retry(self, job_id: UUID) -> AdminJob:
        result = await self._repository.transition_job(
            job_id=job_id,
            allowed=frozenset({JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED}),
            target=JobStatus.QUEUED,
            retry=True,
        )
        return await self._finish_transition(job_id, result, "job_not_retryable")

    async def _finish_transition(
        self, job_id: UUID, result: AdminJob | None, conflict_code: str
    ) -> AdminJob:
        try:
            if result is None:
                if not await self._repository.job_exists(job_id):
                    raise NotFoundError("job_not_found", "Job not found")
                raise ConflictError(conflict_code, "Job state does not allow this transition")
            await self._repository.commit()
            return result
        except Exception:
            await self._repository.rollback()
            raise
