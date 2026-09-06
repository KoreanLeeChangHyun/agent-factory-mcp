"""Validated organization management requests."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.organization.models import MembershipStatus


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OrganizationCreate(RequestModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=39)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if (
            not value.isascii()
            or not value.replace("-", "").isalnum()
            or value != value.lower()
            or value.startswith("-")
            or value.endswith("-")
            or "--" in value
        ):
            raise ValueError("조직 식별자는 영문 소문자, 숫자, 단일 하이픈만 사용할 수 있습니다.")
        return value


class OrganizationUpdate(RequestModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=39)
    revision: int = Field(ge=1)

    _validate_slug = field_validator("slug")(OrganizationCreate.validate_slug.__func__)


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
