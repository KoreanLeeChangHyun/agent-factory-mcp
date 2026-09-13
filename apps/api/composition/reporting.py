from agent_factory_adapters.clock import SystemClock
from agent_factory_adapters.postgres.reporting.repository import PostgresReportingRepository
from agent_factory_core.executions.reporting.use_cases import ReportingUseCases
from sqlalchemy.ext.asyncio import AsyncSession


def reporting_use_cases(session: AsyncSession) -> ReportingUseCases:
    return ReportingUseCases(PostgresReportingRepository(session), SystemClock())
