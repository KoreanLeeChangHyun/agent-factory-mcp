from agent_factory_adapters.clock import SystemClock
from agent_factory_adapters.postgres.agents.repository import PostgresAgentRepository
from agent_factory_adapters.postgres.agents.workspace import PostgresAgentWorkspaceLookup
from agent_factory_adapters.postgres.scheduling.repository import PostgresSchedulingRepository
from agent_factory_core.executions.agents.jobs import DurableAgentJobPublisher
from agent_factory_core.executions.agents.ports import AgentJobPublisher
from agent_factory_core.executions.agents.use_cases import AgentUseCases
from agent_factory_core.executions.scheduling.ports import JobPublisher
from sqlalchemy.ext.asyncio import AsyncSession


def agent_use_cases(
    session: AsyncSession,
    publisher: AgentJobPublisher | JobPublisher | None = None,
    *,
    max_attempts: int = 5,
) -> AgentUseCases:
    clock = SystemClock()
    bridge = (
        publisher
        if publisher is None or hasattr(publisher, "stage")
        else DurableAgentJobPublisher(
            PostgresSchedulingRepository(session),
            PostgresAgentWorkspaceLookup(session),
            publisher, clock, max_attempts,
        )
    )
    return AgentUseCases(PostgresAgentRepository(session), clock, bridge)
