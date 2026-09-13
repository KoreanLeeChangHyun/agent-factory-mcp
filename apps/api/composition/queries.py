"""Wire domain-specific read projections; no SQL or authorization policy here."""

from agent_factory_core.knowledge.queries import DocumentQueries
from agent_factory_adapters.postgres.knowledge.projections import PostgresDocumentProjections

def document_queries(session):
    return DocumentQueries(PostgresDocumentProjections(session))

from agent_factory_core.executions.agents.queries import AgentQueries
from agent_factory_adapters.postgres.agents.projections import PostgresAgentProjections

def agent_queries(session):
    return AgentQueries(PostgresAgentProjections(session))

from agent_factory_core.executions.scheduling.queries import ScheduleQueries
from agent_factory_adapters.postgres.scheduling.projections import PostgresScheduleProjections

def schedule_queries(session):
    return ScheduleQueries(PostgresScheduleProjections(session))

from agent_factory_core.connections.providers.queries import ConnectionQueries
from agent_factory_adapters.postgres.connections.projections import PostgresConnectionProjections

def connection_queries(session):
    return ConnectionQueries(PostgresConnectionProjections(session))
