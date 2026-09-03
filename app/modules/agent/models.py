"""Versioned Agent definitions and durable execution records."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AgentStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AgentRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELLED = "cancelled"


class ToolCallStatus(StrEnum):
    STARTED = "started"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class AgentDefinition(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, RevisionMixin, Base):
    __tablename__ = "agent_definitions"
    __table_args__ = (UniqueConstraint("workspace_id", "slug"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[AgentStatus] = mapped_column(
        Enum(
            AgentStatus, native_enum=False, values_callable=lambda values: [v.value for v in values]
        ),
        default=AgentStatus.ACTIVE,
    )
    current_version_number: Mapped[int] = mapped_column(default=0)


class AgentVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_versions"
    __table_args__ = (UniqueConstraint("agent_definition_id", "version_number"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_definition_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_definitions.id", ondelete="CASCADE"), index=True
    )
    version_number: Mapped[int]
    instructions: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(200))
    configuration: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    allowed_tools: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))


class AgentRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_runs"
    __table_args__ = (UniqueConstraint("workspace_id", "idempotency_key"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_definition_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_definitions.id", ondelete="RESTRICT"), index=True
    )
    agent_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_versions.id", ondelete="RESTRICT"), index=True
    )
    requested_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    retry_of_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="SET NULL")
    )
    status: Mapped[AgentRunStatus] = mapped_column(
        Enum(
            AgentRunStatus,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        ),
        default=AgentRunStatus.QUEUED,
        index=True,
    )
    idempotency_key: Mapped[str] = mapped_column(String(160))
    input_payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    output_payload: Mapped[dict[str, object] | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(120))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Numeric(14, 6), default=0)


class AgentRunEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_run_events"
    __table_args__ = (UniqueConstraint("agent_run_id", "sequence"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int]
    event_type: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)


class AgentRunArtifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_run_artifacts"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(80))
    storage_key: Mapped[str | None] = mapped_column(String(1024))
    artifact_metadata: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)


class AgentRunToolCall(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_run_tool_calls"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True
    )
    tool_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[ToolCallStatus] = mapped_column(
        Enum(
            ToolCallStatus,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        )
    )
    request_payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    response_payload: Mapped[dict[str, object] | None] = mapped_column(JSON)
    error_message: Mapped[str | None] = mapped_column(Text)


class AgentDocumentLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_document_links"
    __table_args__ = (UniqueConstraint("agent_run_id", "document_id", "relation"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="RESTRICT"), index=True
    )
    relation: Mapped[str] = mapped_column(String(40))
