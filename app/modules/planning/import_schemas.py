"""Versioned interchange contract submitted by external AI clients."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.planning.schemas import ItemFields


class ImportSource(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    provider: Literal["excel", "google_sheets", "notion", "jira", "other"]
    external_id: str = Field(min_length=1, max_length=500)
    label: str = Field(min_length=1, max_length=200)
    location: str = Field(default="", max_length=2000)
    read_scope: str = Field(min_length=1, max_length=2000)
    complete: bool


class Correction(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    field: str = Field(min_length=1, max_length=100)
    original: str = Field(max_length=4000)
    reason: str = Field(min_length=1, max_length=2000)


class ImportItem(ItemFields):
    source_id: str = Field(min_length=1, max_length=500)
    kind: Literal["domain", "feature", "issue"]
    parent_source_id: str | None = Field(default=None, max_length=500)
    existing_id: UUID | None = None
    parent_id: UUID | None = None
    source_location: str = Field(default="", max_length=2000)
    original_values: dict[
        Annotated[str, Field(min_length=1, max_length=100)], Annotated[str, Field(max_length=4000)]
    ] = Field(default_factory=dict, max_length=30)
    corrections: list[Correction] = Field(default_factory=list, max_length=30)
    questions: list[Annotated[str, Field(min_length=1, max_length=2000)]] = Field(
        default_factory=list, max_length=30
    )


class ImportProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    version: Literal[1] = 1
    request_key: str = Field(min_length=1, max_length=160)
    source: ImportSource
    items: list[ImportItem] = Field(min_length=1, max_length=500)


class ImportApply(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preview_digest: str = Field(min_length=64, max_length=64)
    acknowledge_warnings: bool = False
