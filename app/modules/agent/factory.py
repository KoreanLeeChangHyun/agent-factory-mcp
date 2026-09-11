"""Request-scoped agent service composition shared by HTTP and MCP adapters."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.infrastructure.job_queue import CeleryJobPublisher
from app.modules.agent.execution_service import AgentExecutionService
from app.modules.agent.repository import AgentRepository
from app.modules.agent.service import AgentService
from app.modules.schedule.repository import ScheduleRepository
from app.modules.schedule.service import ScheduleService


def agent_execution_service(session: AsyncSession) -> AgentExecutionService:
    """Build the canonical execution use case for one database session."""
    return AgentExecutionService(
        AgentService(AgentRepository(session)),
        ScheduleService(ScheduleRepository(session), CeleryJobPublisher(), settings),
    )
