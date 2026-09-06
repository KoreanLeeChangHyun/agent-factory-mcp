"""Strict write contracts for the three planning levels."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ItemFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=20000)
    acceptance: str = Field(default="", max_length=10000)
    assignee: str = Field(default="", max_length=160)
    status: Literal["pending", "active", "done"] = "pending"
    blocked_reason: str = Field(default="", max_length=2000)
    start_date: date | None = None
    target_date: date | None = None

    @model_validator(mode="after")
    def valid_dates(self):
        if self.start_date and self.target_date and self.start_date > self.target_date:
            raise ValueError("시작일은 목표일보다 늦을 수 없습니다.")
        return self


class ItemCreate(ItemFields):
    kind: Literal["domain", "feature", "issue"]
    parent_id: UUID | None = None


class ItemUpdate(ItemFields):
    revision: int = Field(ge=1)


class ItemResponse(ItemFields):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    workspace_id: UUID
    parent_id: UUID | None
    kind: str
    revision: int


class SettingsWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    launch_date: date | None
    revision: int = Field(ge=0)
