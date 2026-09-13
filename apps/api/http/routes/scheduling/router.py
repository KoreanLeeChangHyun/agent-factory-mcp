from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Annotated, NoReturn
from uuid import UUID

from agent_factory_core.executions.scheduling.domain import Job, JobEvent, Schedule, ScheduleDraft
from agent_factory_core.executions.scheduling.use_cases import SchedulingUseCases
from agent_factory_core.identity.authorization import AuthorizedContext
from agent_factory_core.shared.errors import ApplicationError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=160)
    task_type: str = Field(min_length=1, max_length=120)
    queue: str = Field(min_length=1, max_length=80)
    payload: dict[str, object] = Field(default_factory=dict)
    cron_expression: str | None = Field(default=None, max_length=120)
    interval_seconds: int | None = Field(default=None, ge=60)
    timezone: str = Field(default="UTC", max_length=80)
    expected_revision: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def expression(self) -> ScheduleRequest:
        if (self.cron_expression is None) == (self.interval_seconds is None):
            raise ValueError("exactly one schedule expression is required")
        return self

    def draft(self) -> ScheduleDraft:
        return ScheduleDraft(
            self.name,
            self.task_type,
            self.queue,
            self.payload,
            self.cron_expression,
            self.interval_seconds,
            self.timezone,
        )


class ToggleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool
    expected_revision: int = Field(ge=1)


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_type: str = Field(min_length=1, max_length=120)
    queue: str = Field(min_length=1, max_length=80)
    payload: dict[str, object] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=8, max_length=200)
    priority: int = Field(default=5, ge=0, le=9)


def _value(value: object) -> object:
    if isinstance(value, UUID):
        return value.hex
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


def present(record: Schedule | Job | JobEvent) -> dict[str, object]:
    return {name: _value(getattr(record, name)) for name in record.__dataclass_fields__}


def _raise(error: ApplicationError) -> NoReturn:
    raise HTTPException(
        error.status_code, detail={"code": error.code, "message": error.message, **error.details}
    ) from error


def create_scheduling_router(
    service_dependency: Callable[..., SchedulingUseCases],
    context_dependency: Callable[..., AuthorizedContext],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}", tags=["scheduling"]
    )
    service_dep, context_dep = Depends(service_dependency), Depends(context_dependency)

    @router.get("/schedules")
    async def schedules(
        service: SchedulingUseCases = service_dep, context: AuthorizedContext = context_dep
    ) -> list[dict[str, object]]:
        try:
            return [present(row) for row in await service.schedules(context)]
        except ApplicationError as error:
            _raise(error)

    @router.post(
        "/schedules", status_code=status.HTTP_201_CREATED, dependencies=[Depends(csrf_dependency)]
    )
    async def create(
        payload: ScheduleRequest,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            return present(await service.create_schedule(context, payload.draft()))
        except ApplicationError as error:
            _raise(error)

    @router.put("/schedules/{schedule_id}", dependencies=[Depends(csrf_dependency)])
    async def update(
        schedule_id: UUID,
        payload: ScheduleRequest,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        if payload.expected_revision is None:
            raise HTTPException(422, detail={"code": "revision_required"})
        try:
            return present(
                await service.update_schedule(
                    context, schedule_id, payload.draft(), payload.expected_revision
                )
            )
        except ApplicationError as error:
            _raise(error)

    @router.patch("/schedules/{schedule_id}/enabled", dependencies=[Depends(csrf_dependency)])
    async def toggle(
        schedule_id: UUID,
        payload: ToggleRequest,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            return present(
                await service.set_enabled(
                    context, schedule_id, payload.enabled, payload.expected_revision
                )
            )
        except ApplicationError as error:
            _raise(error)

    @router.delete(
        "/schedules/{schedule_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(csrf_dependency)],
    )
    async def remove(
        schedule_id: UUID,
        revision: Annotated[int, Query(ge=1)],
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> None:
        try:
            await service.delete_schedule(context, schedule_id, revision)
        except ApplicationError as error:
            _raise(error)

    @router.get("/jobs")
    async def jobs(
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
        limit: Annotated[int, Query(ge=1, le=100)] = 100,
    ) -> list[dict[str, object]]:
        try:
            return [present(row) for row in (await service.jobs(context))[:limit]]
        except ApplicationError as error:
            _raise(error)

    @router.post(
        "/jobs", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(csrf_dependency)]
    )
    async def enqueue(
        payload: JobRequest,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            return present(
                await service.enqueue(
                    context,
                    task_type=payload.task_type,
                    queue=payload.queue,
                    payload=payload.payload,
                    idempotency_key=payload.idempotency_key,
                    priority=payload.priority,
                )
            )
        except ApplicationError as error:
            _raise(error)

    @router.get("/jobs/{job_id}/events")
    async def events(
        job_id: UUID,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> list[dict[str, object]]:
        try:
            return [present(row) for row in await service.job_events(context, job_id)]
        except ApplicationError as error:
            _raise(error)

    @router.post("/jobs/{job_id}/cancel", dependencies=[Depends(csrf_dependency)])
    async def cancel(
        job_id: UUID,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            return present(await service.cancel(context, job_id))
        except ApplicationError as error:
            _raise(error)

    @router.post(
        "/jobs/{job_id}/retry",
        status_code=status.HTTP_202_ACCEPTED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def retry(
        job_id: UUID,
        service: SchedulingUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            return present(await service.retry(context, job_id))
        except ApplicationError as error:
            _raise(error)

    return router
