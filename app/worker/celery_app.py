"""Celery process shared by workers and the scheduler."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "agent_factory",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    enable_utc=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_soft_time_limit=settings.worker_soft_time_limit_seconds,
    task_time_limit=settings.worker_time_limit_seconds,
    task_default_queue="default",
    task_routes={
        "agent_factory.execute_job": {"queue": "default"},
        "agent_factory.dispatch_due_schedules": {"queue": "control"},
        "agent_factory.dispatch_due_retries": {"queue": "control"},
    },
    beat_schedule={
        "dispatch-due-schedules": {
            "task": "agent_factory.dispatch_due_schedules",
            "schedule": 60.0,
        },
        "dispatch-due-retries": {
            "task": "agent_factory.dispatch_due_retries",
            "schedule": 30.0,
        },
    },
    timezone="UTC",
)

celery_app.autodiscover_tasks(["app.worker"])
