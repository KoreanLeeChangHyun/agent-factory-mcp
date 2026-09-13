from agent_factory_adapters.postgres.planning.calendar import KoreanHolidayCalendar
from agent_factory_adapters.postgres.planning.repository import PostgresPlanningRepository
from agent_factory_core.executions.planning.use_cases import PlanningUseCases
from sqlalchemy.ext.asyncio import AsyncSession


def planning_use_cases(session: AsyncSession) -> PlanningUseCases:
    return PlanningUseCases(PostgresPlanningRepository(session), KoreanHolidayCalendar())
