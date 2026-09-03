"""Celery delivery adapter for authoritative Job records."""

from app.modules.schedule.models import Job
from app.worker.celery_app import celery_app


class CeleryJobPublisher:
    def publish(self, job: Job, *, countdown: int = 0) -> str:
        result = celery_app.send_task(
            "agent_factory.execute_job",
            kwargs={
                "job_id": str(job.id),
                "organization_id": str(job.organization_id),
                "workspace_id": str(job.workspace_id),
                "user_id": str(job.requested_by_user_id),
            },
            queue=job.queue,
            priority=job.priority,
            countdown=countdown,
        )
        return result.id
