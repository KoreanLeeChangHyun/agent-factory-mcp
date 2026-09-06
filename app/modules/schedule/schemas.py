"""Schedule and durable Job API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.modules.schedule.models import JobStatus


class ScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    task_type: str = Field(min_length=1, max_length=120)
    queue: str = Field(min_length=1, max_length=80)
    payload: dict[str, object] = Field(default_factory=dict)
    cron_expression: str | None = Field(default=None, max_length=120)
    interval_seconds: int | None = Field(default=None, ge=60)
    timezone: str = Field(default="UTC", max_length=80)

    @model_validator(mode="after")
    def exactly_one_expression(self) -> "ScheduleCreate":
        if (self.cron_expression is None) == (self.interval_seconds is None):
            raise ValueError("exactly one schedule expression is required")
        return self


class ScheduleResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    task_type: str
    queue: str
    cron_expression: str | None
    interval_seconds: int | None
    timezone: str
    payload: dict[str, object]
    is_enabled: bool
    next_run_at: datetime
    last_run_at: datetime | None
    revision: int


class JobCreate(BaseModel):
    task_type: str = Field(min_length=1, max_length=120)
    queue: str = Field(min_length=1, max_length=80)
    payload: dict[str, object] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=8, max_length=200)
    priority: int = Field(default=5, ge=0, le=9)


class JobResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    schedule_id: UUID | None
    task_type: str
    queue: str
    status: JobStatus
    priority: int
    idempotency_key: str
    payload: dict[str, object]
    result: dict[str, object] | None
    attempt_count: int
    max_attempts: int
    next_attempt_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class ScheduleUpdate(ScheduleCreate):
    revision: int = Field(ge=1)


class ScheduleToggle(BaseModel):
    is_enabled: bool
    revision: int = Field(ge=1)
