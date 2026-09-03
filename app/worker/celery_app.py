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
)
