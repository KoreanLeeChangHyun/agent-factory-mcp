"""Compose worker use cases with infrastructure and registered domain handlers."""

from agent_factory_adapters.postgres.scheduling.execution_lease import PostgresExecutionLeaseFactory
from agent_factory_adapters.postgres.scheduling.repository import PostgresSchedulingRepository
from agent_factory_adapters.redis.scheduling.publisher import CeleryClient, CeleryJobPublisher
from agent_factory_core.executions.scheduling.dispatch import DispatchSchedules
from agent_factory_core.executions.scheduling.execution import ExecuteJob
from agent_factory_core.executions.scheduling.ports import (
    ExecutionAuthorizer,
    Handler,
    JobLifecycle,
)
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


def job_executor(
    engine: AsyncEngine,
    celery: CeleryClient,
    handlers: dict[str, Handler],
    authorizer: ExecutionAuthorizer,
    lifecycle: JobLifecycle | None = None,
    *,
    retry_base_seconds: int = 30,
    retry_max_seconds: int = 3600,
) -> ExecuteJob:
    return ExecuteJob(
        PostgresExecutionLeaseFactory(engine),
        handlers,
        authorizer,
        lifecycle,
        retry_publisher=CeleryJobPublisher(celery),
        retry_base_seconds=retry_base_seconds,
        retry_max_seconds=retry_max_seconds,
    )


def schedule_dispatcher(
    session: AsyncSession, celery: CeleryClient, *, max_attempts: int = 5
) -> DispatchSchedules:
    return DispatchSchedules(
        PostgresSchedulingRepository(session), CeleryJobPublisher(celery), max_attempts=max_attempts
    )
