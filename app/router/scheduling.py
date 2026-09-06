"""Workspace schedules and durable jobs API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.job_queue import CeleryJobPublisher
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.schedule.repository import ScheduleRepository
from app.modules.schedule.schemas import JobCreate, JobResponse, ScheduleCreate, ScheduleResponse
from app.modules.schedule.service import ScheduleService

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}",
    tags=["scheduling"],
)


def get_schedule_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScheduleService:
    return ScheduleService(ScheduleRepository(session), CeleryJobPublisher(), settings)


@router.get("/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    context: Annotated[AuthorizedContext, Depends(require_permission("schedule.read"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> list[ScheduleResponse]:
    return [
        ScheduleResponse.model_validate(record, from_attributes=True)
        for record in await service.list_schedules(context)
    ]


@router.post(
    "/schedules",
    response_model=ScheduleResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_schedule(
    payload: ScheduleCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("schedule.create"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> ScheduleResponse:
    record = await service.create_schedule(
        context,
        payload.name,
        payload.task_type,
        payload.queue,
        payload.payload,
        payload.cron_expression,
        payload.interval_seconds,
        payload.timezone,
    )
    return ScheduleResponse.model_validate(record, from_attributes=True)


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(
    context: Annotated[AuthorizedContext, Depends(require_permission("job.read"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> list[JobResponse]:
    return [
        JobResponse.model_validate(record, from_attributes=True)
        for record in await service.list_jobs(context)
    ]


@router.post(
    "/jobs", response_model=JobResponse, status_code=202, dependencies=[Depends(require_csrf)]
)
async def enqueue_job(
    payload: JobCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("job.create"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> JobResponse:
    record = await service.enqueue(
        context,
        payload.task_type,
        payload.queue,
        payload.payload,
        payload.idempotency_key,
        payload.priority,
    )
    return JobResponse.model_validate(record, from_attributes=True)


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("job.read"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> JobResponse:
    return JobResponse.model_validate(await service.get_job(context, job_id), from_attributes=True)


@router.post(
    "/jobs/{job_id}/cancel",
    response_model=JobResponse,
    dependencies=[Depends(require_csrf)],
)
async def cancel_job(
    job_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("job.cancel"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> JobResponse:
    return JobResponse.model_validate(await service.cancel(context, job_id), from_attributes=True)


@router.post(
    "/jobs/{job_id}/retry",
    response_model=JobResponse,
    status_code=202,
    dependencies=[Depends(require_csrf)],
)
async def retry_job(
    job_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("job.retry"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> JobResponse:
    return JobResponse.model_validate(await service.retry(context, job_id), from_attributes=True)


from app.modules.schedule.schemas import ScheduleUpdate, ScheduleToggle


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse, dependencies=[Depends(require_csrf)])
async def update_schedule(schedule_id: UUID, payload: ScheduleUpdate,
    context: Annotated[AuthorizedContext, Depends(require_permission("schedule.update"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)]):
    return ScheduleResponse.model_validate(await service.change_schedule(context, schedule_id, payload=payload, revision=payload.revision), from_attributes=True)


@router.patch("/schedules/{schedule_id}/enabled", response_model=ScheduleResponse, dependencies=[Depends(require_csrf)])
async def toggle_schedule(schedule_id: UUID, payload: ScheduleToggle,
    context: Annotated[AuthorizedContext, Depends(require_permission("schedule.toggle"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)]):
    return ScheduleResponse.model_validate(await service.change_schedule(context, schedule_id, enabled=payload.is_enabled, revision=payload.revision), from_attributes=True)


@router.delete("/schedules/{schedule_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def delete_schedule(schedule_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("schedule.delete"))],
    service: Annotated[ScheduleService, Depends(get_schedule_service)]):
    await service.change_schedule(context, schedule_id, remove=True)
