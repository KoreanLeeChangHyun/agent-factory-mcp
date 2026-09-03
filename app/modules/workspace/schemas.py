"""Workspace management API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator

from app.modules.workspace.models import WorkspaceStatus


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    revision: int = Field(ge=1)


class WorkspaceResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    status: WorkspaceStatus
    revision: int
    created_at: datetime
    updated_at: datetime


class RepositoryCreate(BaseModel):
    location: str = Field(min_length=1, max_length=2048)
    remote_url: HttpUrl | None = None
    metadata: dict[str, object] = Field(default_factory=dict)

    @field_validator("location")
    @classmethod
    def no_control_characters(cls, value: str) -> str:
        if any(ord(character) < 32 for character in value):
            raise ValueError("repository location contains control characters")
        return value.strip()


class RepositoryResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    canonical_location: str
    remote_url: str | None
    repository_metadata: dict[str, object]


class WorkspaceUsageResponse(BaseModel):
    members: int
    repositories: int


class WorkspaceMemberCreate(BaseModel):
    email: EmailStr
    role: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=80)


class WorkspaceMemberResponse(BaseModel):
    user_id: UUID
    email: str
    display_name: str
    role: str
