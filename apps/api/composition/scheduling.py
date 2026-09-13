from agent_factory_adapters.postgres.scheduling.repository import PostgresSchedulingRepository
from agent_factory_adapters.redis.scheduling.publisher import CeleryClient, CeleryJobPublisher
from agent_factory_core.executions.scheduling.use_cases import SchedulingUseCases
from sqlalchemy.ext.asyncio import AsyncSession


def scheduling_use_cases(
    session: AsyncSession, celery: CeleryClient, *, max_attempts: int = 5
) -> SchedulingUseCases:
    return SchedulingUseCases(
        PostgresSchedulingRepository(session), CeleryJobPublisher(celery), max_attempts=max_attempts
    )
