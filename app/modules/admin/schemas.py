"""Platform administration response and mutation schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.identity.models import UserStatus
from app.modules.schedule.models import JobStatus


class DashboardResponse(BaseModel):
    users: int
    organizations: int
    workspaces: int
    jobs: int
    integrations: int


class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    status: UserStatus
    is_platform_admin: bool
    created_at: datetime


class UserStatusUpdate(BaseModel):
    status: UserStatus


class AdminOrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_personal: bool
    created_at: datetime


class AdminWorkspaceResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    status: str
    created_at: datetime


class OwnershipGrant(BaseModel):
    scope: Literal["organization", "workspace"]
    resource_id: UUID
    user_id: UUID


class AdminJobResponse(BaseModel):
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    task_type: str
    queue: str
    status: JobStatus
    attempt_count: int
    max_attempts: int
    error_code: str | None
    error_message: str | None
    created_at: datetime


class AdminIntegrationResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    provider_id: UUID
    name: str
    status: str
    last_error_code: str | None
    created_at: datetime


class FeatureFlagUpdate(BaseModel):
    is_enabled: bool
    description: str = Field(default="", max_length=500)
    rules: dict[str, object] = Field(default_factory=dict)


class FeatureFlagResponse(FeatureFlagUpdate):
    key: str
    updated_at: datetime


class RuntimeInfoResponse(BaseModel):
    application_version: str
    migration_version: str | None
    environment: str
    debug: bool
    embedding_provider: str
