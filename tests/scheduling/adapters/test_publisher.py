from types import SimpleNamespace
from uuid import uuid4

from agent_factory_adapters.redis.scheduling.publisher import CeleryJobPublisher
from agent_factory_core.executions.scheduling.domain import new_job


def test_publisher_sends_only_durable_job_identity_to_pinned_queue() -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    class Client:
        def send_task(self, name: str, **kwargs: object) -> object:
            calls.append((name, kwargs))
            return SimpleNamespace(id="task-1")

    job = new_job(
        organization_id=uuid4(),
        workspace_id=uuid4(),
        user_id=uuid4(),
        task_type="agent.run",
        queue="agents",
        payload={"secret": "not-transported"},
        idempotency_key="request-0001",
        priority=7,
        max_attempts=5,
    )
    assert CeleryJobPublisher(Client()).publish(job) == "task-1"
    assert calls == [
        (
            "agent_factory.execute_job",
            {"args": [str(job.id)], "queue": "agents", "priority": 7, "countdown": 0},
        )
    ]


def test_broker_client_does_not_load_worker_application() -> None:
    from agent_factory_adapters.redis.scheduling.client import create_celery_client

    client = create_celery_client("memory://", "cache+memory://")
    try:
        assert client.conf.broker_url == "memory://"
        assert client.conf.accept_content == ["json"]
        assert not client.conf.include
        assert "agent_factory.execute_job" not in client.tasks
    finally:
        client.close()
