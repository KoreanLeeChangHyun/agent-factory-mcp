from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from uuid import UUID, uuid4

from agent_factory_core.executions.scheduling.domain import Job, JobEvent, JobStatus, Schedule
from agent_factory_core.shared.errors import ConflictError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


def _json_object(value: object) -> dict[str, object]:
    if not isinstance(value, Mapping) or not all(isinstance(key, str) for key in value):
        raise TypeError("stored JSON value must be an object with string keys")
    return dict(value)


def _integer(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise TypeError("stored integer value is invalid")
    return int(value)


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise TypeError("stored timestamp value is invalid")
    return value


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)


class PostgresSchedulingRepository:
    """SQL adapter over the existing schedules/jobs tables; RLS context is established upstream."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def control_plane_job(self, job_id: UUID) -> Job | None:
        row = (
            (await self.session.execute(text("SELECT * FROM jobs WHERE id=:id"), {"id": job_id}))
            .mappings()
            .one_or_none()
        )
        return self._job(row) if row else None

    @staticmethod
    def _schedule(row: Mapping[str, object]) -> Schedule:
        return Schedule(
            id=UUID(str(row["id"])),
            organization_id=UUID(str(row["organization_id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            name=str(row["name"]),
            task_type=str(row["task_type"]),
            queue=str(row["queue"]),
            payload=_json_object(row["payload"]),
            cron_expression=str(row["cron_expression"]) if row["cron_expression"] else None,
            interval_seconds=_integer(row["interval_seconds"])
            if row["interval_seconds"] is not None
            else None,
            timezone=str(row["timezone"]),
            is_enabled=bool(row["is_enabled"]),
            next_run_at=_datetime(row["next_run_at"]),
            last_run_at=_optional_datetime(row["last_run_at"]),
            created_by_user_id=UUID(str(row["created_by_user_id"])),
            execution_user_id=UUID(str(row["execution_user_id"]))
            if row["execution_user_id"]
            else None,
            revision=_integer(row["revision"]),
        )

    @staticmethod
    def _job(row: Mapping[str, object]) -> Job:
        return Job(
            id=UUID(str(row["id"])),
            organization_id=UUID(str(row["organization_id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            requested_by_user_id=UUID(str(row["requested_by_user_id"])),
            task_type=str(row["task_type"]),
            queue=str(row["queue"]),
            priority=_integer(row["priority"]),
            idempotency_key=str(row["idempotency_key"]),
            payload=_json_object(row["payload"]),
            status=JobStatus(str(row["status"])),
            schedule_id=UUID(str(row["schedule_id"])) if row["schedule_id"] else None,
            result=_json_object(row["result"]) if row["result"] else None,
            attempt_count=_integer(row["attempt_count"]),
            max_attempts=_integer(row["max_attempts"]),
            next_attempt_at=_optional_datetime(row["next_attempt_at"]),
            broker_task_id=str(row["celery_task_id"]) if row["celery_task_id"] else None,
            started_at=_optional_datetime(row["started_at"]),
            finished_at=_optional_datetime(row["finished_at"]),
            dead_lettered_at=_optional_datetime(row["dead_lettered_at"]),
            error_code=str(row["error_code"]) if row["error_code"] else None,
            error_message=str(row["error_message"]) if row["error_message"] else None,
            created_at=_datetime(row["created_at"]),
            updated_at=_datetime(row["updated_at"]),
        )

    async def list_schedules(self, workspace_id: UUID) -> list[Schedule]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT * FROM schedules WHERE workspace_id=:wid AND deleted_at IS NULL ORDER BY name"
                ),
                {"wid": workspace_id},
            )
        ).mappings()
        return [self._schedule(row) for row in rows]

    async def get_schedule(
        self, workspace_id: UUID, schedule_id: UUID, *, lock: bool = False
    ) -> Schedule | None:
        suffix = " FOR UPDATE" if lock else ""
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM schedules WHERE workspace_id=:wid AND id=:id AND deleted_at IS NULL"
                        + suffix
                    ),
                    {"wid": workspace_id, "id": schedule_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._schedule(row) if row else None

    async def insert_schedule(self, value: Schedule) -> Schedule:
        try:
            row = (
                (
                    await self.session.execute(
                        text("""INSERT INTO schedules
            (id,organization_id,workspace_id,name,task_type,queue,payload,cron_expression,interval_seconds,timezone,is_enabled,next_run_at,last_run_at,created_by_user_id,execution_user_id,revision)
            VALUES (:id,:organization_id,:workspace_id,:name,:task_type,:queue,CAST(:payload AS jsonb),:cron_expression,:interval_seconds,:timezone,:is_enabled,:next_run_at,:last_run_at,:created_by_user_id,:execution_user_id,:revision) RETURNING *"""),
                        self._schedule_values(value),
                    )
                )
                .mappings()
                .one()
            )
        except IntegrityError as error:
            raise ConflictError("schedule_exists", "Schedule name already exists") from error
        return self._schedule(row)

    async def replace_schedule(self, value: Schedule, expected_revision: int) -> Schedule | None:
        values = self._schedule_values(value) | {"expected_revision": expected_revision}
        try:
            row = (
                (
                    await self.session.execute(
                        text(
                            """UPDATE schedules SET name=:name,task_type=:task_type,queue=:queue,payload=CAST(:payload AS jsonb),cron_expression=:cron_expression,interval_seconds=:interval_seconds,timezone=:timezone,is_enabled=:is_enabled,next_run_at=:next_run_at,last_run_at=:last_run_at,execution_user_id=:execution_user_id,revision=:revision,updated_at=now() WHERE id=:id AND workspace_id=:workspace_id AND revision=:expected_revision RETURNING *"""
                        ),
                        values,
                    )
                )
                .mappings()
                .one_or_none()
            )
        except IntegrityError as error:
            raise ConflictError("schedule_exists", "Schedule name already exists") from error
        return self._schedule(row) if row else None

    async def delete_schedule(
        self, workspace_id: UUID, schedule_id: UUID, expected_revision: int
    ) -> bool:
        result = await self.session.execute(
            text(
                "UPDATE schedules SET is_enabled=false,deleted_at=now(),revision=revision+1,updated_at=now() WHERE workspace_id=:wid AND id=:id AND deleted_at IS NULL AND revision=:revision"
            ),
            {"wid": workspace_id, "id": schedule_id, "revision": expected_revision},
        )
        return getattr(result, "rowcount", 0) == 1

    @staticmethod
    def _schedule_values(value: Schedule) -> dict[str, object]:
        return {
            **{
                name: getattr(value, name)
                for name in value.__dataclass_fields__
                if name != "payload"
            },
            "payload": json.dumps(value.payload, separators=(",", ":")),
        }

    async def find_job(self, workspace_id: UUID, idempotency_key: str) -> Job | None:
        row = (
            (
                await self.session.execute(
                    text("SELECT * FROM jobs WHERE workspace_id=:wid AND idempotency_key=:key"),
                    {"wid": workspace_id, "key": idempotency_key},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._job(row) if row else None

    async def insert_job(self, value: Job) -> Job:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO jobs
            (id,organization_id,workspace_id,schedule_id,requested_by_user_id,task_type,queue,status,priority,idempotency_key,payload,attempt_count,max_attempts)
            VALUES (:id,:organization_id,:workspace_id,:schedule_id,:requested_by_user_id,:task_type,:queue,:status,:priority,:idempotency_key,CAST(:payload AS jsonb),:attempt_count,:max_attempts) RETURNING *"""),
                    self._job_values(value),
                )
            )
            .mappings()
            .one()
        )
        return self._job(row)

    async def get_job(self, workspace_id: UUID, job_id: UUID, *, lock: bool = False) -> Job | None:
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT * FROM jobs WHERE workspace_id=:wid AND id=:id"
                        + (" FOR UPDATE" if lock else "")
                    ),
                    {"wid": workspace_id, "id": job_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._job(row) if row else None

    async def list_jobs(self, workspace_id: UUID, limit: int = 100) -> list[Job]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT * FROM jobs WHERE workspace_id=:wid ORDER BY created_at DESC LIMIT :limit"
                ),
                {"wid": workspace_id, "limit": limit},
            )
        ).mappings()
        return [self._job(row) for row in rows]

    async def replace_job(self, value: Job) -> Job:
        row = (
            (
                await self.session.execute(
                    text(
                        """UPDATE jobs SET status=:status,result=CAST(:result AS jsonb),attempt_count=:attempt_count,max_attempts=:max_attempts,next_attempt_at=:next_attempt_at,celery_task_id=:broker_task_id,started_at=:started_at,finished_at=:finished_at,dead_lettered_at=:dead_lettered_at,error_code=:error_code,error_message=:error_message,updated_at=now() WHERE id=:id AND workspace_id=:workspace_id RETURNING *"""
                    ),
                    self._job_values(value),
                )
            )
            .mappings()
            .one()
        )
        return self._job(row)

    @staticmethod
    def _job_values(value: Job) -> dict[str, object]:
        result = {name: getattr(value, name) for name in value.__dataclass_fields__}
        result["status"] = value.status.value
        result["payload"] = json.dumps(value.payload, separators=(",", ":"))
        result["result"] = (
            json.dumps(value.result, separators=(",", ":")) if value.result is not None else None
        )
        return result

    async def append_event(self, job: Job, event_type: str, payload: dict[str, object]) -> JobEvent:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO job_events (id,workspace_id,job_id,sequence,event_type,payload)
            SELECT :id,:wid,:jid,COALESCE(MAX(sequence),0)+1,:event_type,CAST(:payload AS jsonb) FROM job_events WHERE job_id=:jid RETURNING *"""),
                    {
                        "id": uuid4(),
                        "wid": job.workspace_id,
                        "jid": job.id,
                        "event_type": event_type,
                        "payload": json.dumps(payload),
                    },
                )
            )
            .mappings()
            .one()
        )
        return JobEvent(
            UUID(str(row["id"])),
            job.workspace_id,
            job.id,
            _integer(row["sequence"]),
            event_type,
            _json_object(row["payload"]),
            _datetime(row["created_at"]),
        )

    async def list_events(self, workspace_id: UUID, job_id: UUID) -> list[JobEvent]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT * FROM job_events WHERE workspace_id=:wid AND job_id=:jid ORDER BY sequence"
                ),
                {"wid": workspace_id, "jid": job_id},
            )
        ).mappings()
        return [
            JobEvent(
                UUID(str(row["id"])),
                workspace_id,
                job_id,
                _integer(row["sequence"]),
                str(row["event_type"]),
                _json_object(row["payload"]),
                _datetime(row["created_at"]),
            )
            for row in rows
        ]

    async def due_schedules(self, now: datetime, limit: int = 100) -> list[Schedule]:
        rows = (
            await self.session.execute(
                text(
                    """SELECT s.* FROM schedules s JOIN workspaces w ON w.id=s.workspace_id JOIN organizations o ON o.id=s.organization_id WHERE w.organization_id=o.id AND o.deleted_at IS NULL AND w.deleted_at IS NULL AND w.status='active' AND s.is_enabled AND s.deleted_at IS NULL AND s.next_run_at<=:now ORDER BY s.next_run_at FOR UPDATE OF s SKIP LOCKED LIMIT :limit"""
                ),
                {"now": now, "limit": limit},
            )
        ).mappings()
        return [self._schedule(row) for row in rows]

    async def due_dispatches(
        self, now: datetime, stale_before: datetime, limit: int = 100
    ) -> list[Job]:
        rows = (
            await self.session.execute(
                text(
                    """SELECT * FROM jobs WHERE (status='retry' AND next_attempt_at<=:now) OR (status='queued' AND celery_task_id IS NULL) OR (status IN ('running','cancel_requested') AND started_at<:stale) ORDER BY COALESCE(next_attempt_at,created_at) FOR UPDATE SKIP LOCKED LIMIT :limit"""
                ),
                {"now": now, "stale": stale_before, "limit": limit},
            )
        ).mappings()
        return [self._job(row) for row in rows]

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
