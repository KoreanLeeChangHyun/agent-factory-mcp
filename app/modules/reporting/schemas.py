"""Closed, bounded MCP command contract; timestamps are server receipt times."""

import json
import unicodedata
from datetime import datetime
from typing import Annotated
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal["pending", "in_progress", "input_required", "completed", "failed", "cancelled"]


class ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


RuntimeIdentifier = Annotated[
    str, Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
]


class RuntimeBinding(ClosedModel):
    """Opaque local identities, never paths, credentials, or execution authority."""

    project_ref: RuntimeIdentifier
    agent_id: RuntimeIdentifier
    session_id: RuntimeIdentifier
    run_id: RuntimeIdentifier
    loop_id: RuntimeIdentifier | None = None


class HeartbeatWrite(ClosedModel):
    id: UUID
    runtime_binding: RuntimeBinding
    sequence: int = Field(ge=1, le=9223372036854775807, strict=True)
    observed_at: datetime
    fact: Literal["process_alive", "process_exited", "unreachable"]

    @field_validator("observed_at")
    @classmethod
    def aware_time(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("observed_at must include a timezone")
        return value


class SearchQuery(ClosedModel):
    query: str = Field(min_length=1, max_length=256)
    kind: Literal["agent", "task", "report", "result"]
    limit: int = Field(default=20, ge=1, le=100, strict=True)
    after_id: UUID | None = None

    @field_validator("query")
    @classmethod
    def literal_query(cls, value):
        if any(unicodedata.category(c).startswith("C") for c in value):
            raise ValueError("Query must not contain control or format characters")
        if len(value.encode("utf-8")) > 1024:
            raise ValueError("Query exceeds 1024 UTF-8 bytes")
        return value


class AgentWrite(ClosedModel):
    id: UUID
    revision: int = Field(ge=0)
    name: str = Field(min_length=1, max_length=160)
    role: str = Field(min_length=1, max_length=160)
    responsibilities: str = Field(max_length=10000)
    parent_id: UUID | None = None


class TaskWrite(ClosedModel):
    runtime_binding: RuntimeBinding | None = None
    id: UUID
    agent_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=20000)
    parent_id: UUID | None = None
    plan_item_id: UUID | None = None


class ResultWrite(ClosedModel):
    label: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=10000)
    document_id: UUID | None = None
    url: str | None = Field(default=None, max_length=2048)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        if value is not None:
            parsed = urlsplit(value)
            if (
                parsed.scheme not in {"https", "http"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or any(c.isspace() or ord(c) < 32 for c in value)
            ):
                raise ValueError(
                    "Only absolute HTTP(S) result URLs without credentials are allowed"
                )
        return value

    @model_validator(mode="after")
    def one_target(self):
        if self.document_id and self.url:
            raise ValueError("Choose document_id or url")
        return self


class TaskUpdate(ClosedModel):
    runtime_binding: RuntimeBinding | None = None
    id: UUID
    revision: int = Field(ge=1)
    status: Status
    message: str = Field(min_length=1, max_length=10000)
    progress: int | None = Field(default=None, ge=0, le=100, strict=True)
    results: list[ResultWrite] = Field(default_factory=list, max_length=20)


class Command(ClosedModel):
    key: str = Field(min_length=1, max_length=120)
    operation: Literal["agent", "task", "report", "heartbeat"]
    agent: AgentWrite | None = None
    task: TaskWrite | None = None
    report: TaskUpdate | None = None
    heartbeat: HeartbeatWrite | None = None

    @model_validator(mode="after")
    def matching_payload(self):
        if [name for name in ("agent", "task", "report", "heartbeat") if getattr(self, name) is not None] != [
            self.operation
        ]:
            raise ValueError("Supply exactly the payload matching operation")
        if len(json.dumps(self.model_dump(mode="json")).encode()) > 65536:
            raise ValueError("Reporting command exceeds 64 KiB")
        return self
