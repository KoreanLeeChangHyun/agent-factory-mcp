from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from agent_factory_core.shared.errors import ConflictError


class ReportStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    INPUT_REQUIRED = "input_required"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


REPORT_TRANSITIONS = {
    ReportStatus.PENDING: frozenset(
        {ReportStatus.IN_PROGRESS, ReportStatus.INPUT_REQUIRED, ReportStatus.CANCELLED}
    ),
    ReportStatus.IN_PROGRESS: frozenset(
        {
            ReportStatus.IN_PROGRESS,
            ReportStatus.INPUT_REQUIRED,
            ReportStatus.COMPLETED,
            ReportStatus.FAILED,
            ReportStatus.CANCELLED,
        }
    ),
    ReportStatus.INPUT_REQUIRED: frozenset(
        {
            ReportStatus.INPUT_REQUIRED,
            ReportStatus.IN_PROGRESS,
            ReportStatus.FAILED,
            ReportStatus.CANCELLED,
        }
    ),
    ReportStatus.COMPLETED: frozenset(),
    ReportStatus.FAILED: frozenset(),
    ReportStatus.CANCELLED: frozenset(),
}


@dataclass(frozen=True, slots=True)
class RuntimeBinding:
    project_ref: str
    agent_id: str
    session_id: str
    run_id: str
    loop_id: str | None = None


@dataclass(frozen=True, slots=True)
class RuntimeObservation:
    sequence: int
    observed_at: datetime
    received_at: datetime
    fact: str


@dataclass(frozen=True, slots=True)
class ReportAgent:
    id: UUID
    workspace_id: UUID
    owner_user_id: UUID
    name: str
    role: str
    responsibilities: str
    revision: int
    parent_id: UUID | None = None
    last_report_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class AgentWrite:
    id: UUID
    revision: int
    name: str
    role: str
    responsibilities: str
    parent_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class TaskWrite:
    id: UUID
    agent_id: UUID
    name: str
    description: str = ""
    parent_id: UUID | None = None
    plan_item_id: UUID | None = None
    runtime_binding: RuntimeBinding | None = None


@dataclass(frozen=True, slots=True)
class ResultWrite:
    label: str
    summary: str = ""
    document_id: UUID | None = None
    url: str | None = None


@dataclass(frozen=True, slots=True)
class ReportWrite:
    id: UUID
    revision: int
    status: ReportStatus
    message: str
    progress: int | None = None
    results: tuple[ResultWrite, ...] = ()
    runtime_binding: RuntimeBinding | None = None


@dataclass(frozen=True, slots=True)
class HeartbeatWrite:
    id: UUID
    runtime_binding: RuntimeBinding
    sequence: int
    observed_at: datetime
    fact: str


@dataclass(frozen=True, slots=True)
class ReportingCommand:
    key: str
    operation: str
    agent: AgentWrite | None = None
    task: TaskWrite | None = None
    report: ReportWrite | None = None
    heartbeat: HeartbeatWrite | None = None

    def canonical_payload(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ReportTask:
    id: UUID
    workspace_id: UUID
    agent_id: UUID
    owner_user_id: UUID
    name: str
    description: str
    status: ReportStatus
    revision: int
    parent_id: UUID | None = None
    plan_item_id: UUID | None = None
    runtime_binding: RuntimeBinding | None = None
    progress: int | None = None
    last_report_at: datetime | None = None
    runtime_observation: RuntimeObservation | None = None


@dataclass(frozen=True, slots=True)
class SearchRequest:
    query: str
    kind: str
    limit: int = 20
    after_id: UUID | None = None


def require_transition(old: ReportStatus, new: ReportStatus) -> None:
    if new not in REPORT_TRANSITIONS[old]:
        raise ConflictError("invalid_transition", f"Cannot report {old} -> {new}")


def canonical_command_digest(command: dict[str, object]) -> str:
    payload = dict(command)
    if payload.get("heartbeat") is None:
        payload.pop("heartbeat", None)
    for key in ("task", "report"):
        nested = payload.get(key)
        if isinstance(nested, dict) and nested.get("runtime_binding") is None:
            nested = dict(nested)
            nested.pop("runtime_binding", None)
            payload[key] = nested
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        default=lambda value: value.isoformat() if isinstance(value, datetime) else str(value),
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def require_runtime_binding(
    expected: RuntimeBinding | None, supplied: RuntimeBinding | None
) -> None:
    if expected != supplied:
        raise ConflictError(
            "report_runtime_binding_conflict",
            "Runtime binding must exactly match task registration",
        )
