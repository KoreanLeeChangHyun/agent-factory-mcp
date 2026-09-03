"""Agent definition, version, run, and event API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.agent.models import AgentRunStatus, AgentStatus


class AgentDefinitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)
    description: str = Field(default="", max_length=10_000)


class AgentDefinitionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10_000)
    status: AgentStatus
    revision: int = Field(ge=1)


class AgentDefinitionResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    slug: str
    description: str
    status: AgentStatus
    current_version_number: int
    revision: int
    created_at: datetime
    updated_at: datetime


class AgentVersionCreate(BaseModel):
    instructions: str = Field(min_length=1, max_length=200_000)
    model: str = Field(min_length=1, max_length=200)
    configuration: dict[str, object] = Field(default_factory=dict)
    allowed_tools: list[str] = Field(default_factory=list, max_length=200)


class AgentVersionResponse(BaseModel):
    id: UUID
    agent_definition_id: UUID
    version_number: int
    instructions: str
    model: str
    configuration: dict[str, object]
    allowed_tools: list[str]
    created_by_user_id: UUID
    created_at: datetime


class AgentRunCreate(BaseModel):
    agent_version_id: UUID | None = None
    idempotency_key: str = Field(min_length=8, max_length=160)
    input: dict[str, object] = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    agent_definition_id: UUID
    agent_version_id: UUID
    requested_by_user_id: UUID
    retry_of_run_id: UUID | None
    status: AgentRunStatus
    idempotency_key: str
    input_payload: dict[str, object]
    output_payload: dict[str, object] | None
    error_code: str | None
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    created_at: datetime
    updated_at: datetime


class AgentRunEventResponse(BaseModel):
    id: UUID
    agent_run_id: UUID
    sequence: int
    event_type: str
    payload: dict[str, object]
    created_at: datetime
