from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresScheduleProjections:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, workspace_id: UUID):
        rows = await self.session.execute(text('SELECT id, organization_id, workspace_id, name, task_type, queue, cron_expression, interval_seconds, timezone, payload, is_enabled, next_run_at, last_run_at, created_by_user_id, execution_user_id, created_at, updated_at, deleted_at, revision FROM schedules WHERE workspace_id=:wid AND deleted_at IS NULL ORDER BY name'), {"wid": workspace_id})
        return [dict(row) for row in rows.mappings()]

    async def logs(self, workspace_id: UUID):
        rows = await self.session.execute(text("SELECT organization_id, workspace_id, schedule_id, requested_by_user_id, task_type, queue, status, priority, idempotency_key, payload, result, attempt_count, max_attempts, next_attempt_at, celery_task_id, started_at, finished_at, dead_lettered_at, error_code, error_message, id, created_at, updated_at FROM jobs WHERE workspace_id=:wid ORDER BY created_at DESC LIMIT 100"), {"wid": workspace_id})
        return [dict(row) for row in rows.mappings()]

    async def agent_job(self, workspace_id: UUID, run_id: UUID):
        result = await self.session.execute(text("SELECT id, status FROM jobs WHERE workspace_id=:wid AND idempotency_key=:key"), {"wid": workspace_id, "key": f"agent-run:{run_id}"})
        row = result.mappings().one_or_none()
        return dict(row) if row else None
