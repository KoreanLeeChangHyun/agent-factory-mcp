from agent_factory_adapters.redis.scheduling.client import create_celery_client
from agent_factory_adapters.redis.scheduling.publisher import CeleryJobPublisher
from api.settings import settings
from .agents import agent_use_cases


def executable_agents(session):
    client = create_celery_client(settings.celery_broker_url, settings.celery_result_backend)
    return agent_use_cases(session, CeleryJobPublisher(client), max_attempts=settings.job_max_attempts)
