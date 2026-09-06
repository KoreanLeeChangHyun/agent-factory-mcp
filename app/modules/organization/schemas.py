"""Validated organization management requests."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.organization.models import MembershipStatus


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OrganizationCreate(RequestModel):
    name: str = Field(min_length=1, max_length=200)


class OrganizationUpdate(OrganizationCreate):
    revision: int = Field(ge=1)


class RoleWrite(RequestModel):
    name: str = Field(min_length=1, max_length=80)
    scope: Literal["organization", "workspace"]
    permissions: list[str] = Field(max_length=200)


class MemberUpdate(RequestModel):
    role_id: UUID | None = None
    status: MembershipStatus | None = None


class WorkspaceGrant(RequestModel):
    workspace_id: UUID
    role_id: UUID


class InvitationCreate(RequestModel):
    email: EmailStr
    role_id: UUID
    workspace_grants: list[WorkspaceGrant] = Field(default_factory=list, max_length=100)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.casefold()


class InvitationAccept(RequestModel):
    token: str = Field(min_length=20, max_length=200)


class TeamWrite(RequestModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)


class RoleAssignment(RequestModel):
    role_id: UUID


class OwnershipTransfer(RequestModel):
    user_id: UUID
