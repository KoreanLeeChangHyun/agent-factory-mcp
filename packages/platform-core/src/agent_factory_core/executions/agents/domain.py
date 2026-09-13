from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from agent_factory_core.shared.errors import ConflictError


class AgentStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELLED = "cancelled"


RUN_TRANSITIONS = {
    RunStatus.QUEUED: frozenset({RunStatus.RUNNING, RunStatus.CANCELLED}),
    RunStatus.RUNNING: frozenset(
        {RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCEL_REQUESTED}
    ),
    RunStatus.CANCEL_REQUESTED: frozenset(
        {RunStatus.CANCELLED, RunStatus.SUCCEEDED, RunStatus.FAILED}
    ),
    RunStatus.SUCCEEDED: frozenset(),
    RunStatus.FAILED: frozenset(),
    RunStatus.CANCELLED: frozenset(),
}


@dataclass(frozen=True, slots=True)
class AgentDefinition:
    id: UUID
    workspace_id: UUID
    name: str
    slug: str
    description: str
    status: AgentStatus = AgentStatus.ACTIVE
    current_version_number: int = 0
    revision: int = 1


@dataclass(frozen=True, slots=True)
class AgentVersion:
    id: UUID
    workspace_id: UUID
    definition_id: UUID
    version_number: int
    instructions: str
    model: str
    configuration: dict[str, object]
    allowed_tools: tuple[str, ...]
    created_by_user_id: UUID
    created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class AgentRun:
    id: UUID
    workspace_id: UUID
    definition_id: UUID
    version_id: UUID
    requested_by_user_id: UUID
    idempotency_key: str
    input_payload: dict[str, object]
    status: RunStatus = RunStatus.QUEUED
    retry_of_run_id: UUID | None = None
    output_payload: dict[str, object] | None = None
    error_code: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0
    created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class RunEvent:
    id: UUID
    workspace_id: UUID
    run_id: UUID
    sequence: int
    event_type: str
    payload: dict[str, object]
    created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class RunToolCall:
    id: UUID
    workspace_id: UUID
    run_id: UUID
    tool_name: str
    status: str
    request_payload: dict[str, object]
    response_payload: dict[str, object] | None
    error_message: str | None
    created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class RunArtifact:
    id: UUID
    workspace_id: UUID
    run_id: UUID
    kind: str
    storage_key: str | None
    metadata: dict[str, object]
    created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class RunDocumentLink:
    id: UUID
    workspace_id: UUID
    run_id: UUID
    document_id: UUID
    relation: str
    document_title: str
    created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class RunEvidence:
    run: AgentRun
    events: tuple[RunEvent, ...]
    tool_calls: tuple[RunToolCall, ...]
    artifacts: tuple[RunArtifact, ...]
    documents: tuple[RunDocumentLink, ...]


def revise_definition(
    record: AgentDefinition, *, name: str, description: str, status: AgentStatus
) -> AgentDefinition:
    return replace(
        record,
        name=name.strip(),
        description=description.strip(),
        status=status,
        revision=record.revision + 1,
    )


def transition_run(
    record: AgentRun,
    target: RunStatus,
    *,
    now: datetime,
    output: dict[str, object] | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    estimated_cost_usd: float = 0,
) -> AgentRun:
    if target not in RUN_TRANSITIONS[record.status]:
        raise ConflictError(
            "invalid_agent_run_transition",
            f"Cannot transition Agent run from {record.status} to {target}",
        )
    return replace(
        record,
        status=target,
        output_payload=output,
        error_code=error_code,
        error_message=error_message,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost_usd,
        started_at=now if target == RunStatus.RUNNING else record.started_at,
        finished_at=now
        if target in {RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED}
        else record.finished_at,
    )
