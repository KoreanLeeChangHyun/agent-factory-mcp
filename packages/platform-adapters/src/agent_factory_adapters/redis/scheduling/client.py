"""Construct a broker client without importing any application entrypoint."""

from celery import Celery


def create_celery_client(broker_url: str, result_backend: str) -> Celery:
    client = Celery("agent_factory", broker=broker_url, backend=result_backend)
    client.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
    )
    return client
