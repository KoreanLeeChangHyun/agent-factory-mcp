from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from agent_factory_core.shared.errors import ApplicationError


class CollectionMode(StrEnum):
    CONTENT = "content"
    REFERENCE = "reference"


class CollectionRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY = "retry"
    SUCCEEDED = "succeeded"
    BOUNDED = "bounded"
    CANCELLED = "cancelled"
    FAILED = "failed"


TERMINAL_COLLECTION_STATUSES = frozenset(
    {
        CollectionRunStatus.SUCCEEDED,
        CollectionRunStatus.BOUNDED,
        CollectionRunStatus.CANCELLED,
        CollectionRunStatus.FAILED,
    }
)


@dataclass(frozen=True, slots=True)
class CollectionSelection:
    values: dict[str, object]
    max_items: int = 100
    max_pages: int = 100
    max_bytes: int = 50_000_000
    attachments: bool = True

    def validate(self, provider: str) -> CollectionSelection:
        if not 1 <= self.max_items <= 1_000:
            raise ApplicationError("invalid_collection_bounds", "max_items is invalid", 422)
        if not 1 <= self.max_pages <= 1_000:
            raise ApplicationError("invalid_collection_bounds", "max_pages is invalid", 422)
        if not 1 <= self.max_bytes <= 500_000_000:
            raise ApplicationError("invalid_collection_bounds", "max_bytes is invalid", 422)
        allowed = {
            "google-drive": {"folder_id", "file_id", "recursive"},
            "gmail": {"query", "allow_all"},
            "slack": {"channel_id", "channel_type", "oldest", "latest"},
            "notion": {"page_id"},
            "discord": {"channel_id", "before", "after"},
            "onedrive": {"item_id", "path", "drive_id", "include_shared", "recursive"},
        }
        if provider not in allowed or set(self.values) - allowed[provider]:
            raise ApplicationError("invalid_collection_selection", "Selection is unsupported", 422)
        value = self.values
        identities = ("folder_id", "file_id", "channel_id", "page_id", "item_id", "drive_id")
        if any(
            item is not None and not re.fullmatch(r"[A-Za-z0-9_!-]{1,200}", str(item))
            for key in identities
            if (item := value.get(key)) is not None
        ):
            raise ApplicationError("invalid_collection_selection", "Selection ID is invalid", 422)
        valid = {
            "google-drive": bool(value.get("folder_id")) != bool(value.get("file_id")),
            "gmail": bool(str(value.get("query", "")).strip()) or value.get("allow_all") is True,
            "slack": bool(value.get("channel_id")),
            "notion": bool(value.get("page_id")),
            "discord": bool(value.get("channel_id"))
            and not (value.get("before") and value.get("after")),
            "onedrive": bool(value.get("item_id")) != bool(value.get("path")),
        }[provider]
        if provider == "onedrive" and value.get("drive_id") and not value.get("include_shared"):
            valid = False
        if provider == "slack" and value.get("channel_type") not in {
            "public",
            "private",
            "im",
            "mpim",
        }:
            valid = False
        if (
            provider == "gmail"
            and "allow_all" in value
            and not isinstance(value["allow_all"], bool)
        ):
            valid = False
        if (
            provider in {"google-drive", "onedrive"}
            and "recursive" in value
            and not isinstance(value["recursive"], bool)
        ):
            valid = False
        if provider == "onedrive" and value.get("path"):
            parts = str(value["path"]).split("/")
            if len(str(value["path"])) > 1024 or any(part in {"", ".", ".."} for part in parts):
                valid = False
        if not valid or "cursor" in value or "url" in value:
            raise ApplicationError(
                "invalid_collection_selection", "Explicit bounded source selection is required", 422
            )
        return self


@dataclass(frozen=True, slots=True)
class ProviderCollection:
    id: UUID
    workspace_id: UUID
    connection_id: UUID
    provider: str
    name: str
    selection: CollectionSelection
    mode: CollectionMode
    created_by_user_id: UUID
    enabled: bool = True
    last_refresh_status: CollectionRunStatus | None = None
    last_refreshed_at: datetime | None = None
    last_error_code: str | None = None


@dataclass(frozen=True, slots=True)
class CollectionResult:
    source_id: str
    document_id: UUID
    revision_number: int | None
    sha256: str | None
    changed: bool
    source_url: str | None = None
    body_stored: bool = True
    limitations: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class CollectionRun:
    id: UUID
    workspace_id: UUID
    collection_id: UUID
    requested_by_user_id: UUID
    request_key: str
    status: CollectionRunStatus
    job_id: UUID | None = None
    cursor: dict[str, object] = field(default_factory=dict)
    results: tuple[CollectionResult, ...] = ()
    examined: int = 0
    pages: int = 0
    bytes_read: int = 0
    cancel_requested: bool = False
    error_code: str | None = None
    finished_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class SourceArtifact:
    filename: str
    media_type: str
    content: bytes


@dataclass(frozen=True, slots=True)
class SourceItem:
    source_id: str
    title: str
    artifacts: tuple[SourceArtifact, ...]
    metadata: dict[str, object]
    limitations: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SourcePage:
    items: tuple[SourceItem, ...]
    cursor: dict[str, object]
    done: bool
    examined: int
    bytes_read: int


@dataclass(frozen=True, slots=True)
class CollectionJob:
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    requested_by_user_id: UUID
    task_type: str
    status: str
    payload: dict[str, object]
    idempotency_key: str


@dataclass(frozen=True, slots=True)
class ProviderInspection:
    workspace_id: UUID
    connection_id: UUID
    health: str
    account_id: str | None
    requested_scopes: tuple[str, ...]
    granted_scopes: tuple[str, ...] | None
    scope_support: str
    observed_at: datetime
    stale: bool = False
    error_code: str | None = None


@dataclass(frozen=True, slots=True)
class DriveSource:
    source_id: str
    name: str
    mime_type: str
    parent_ids: tuple[str, ...]
    modified_at: str | None


@dataclass(frozen=True, slots=True)
class DriveSourcePage:
    items: tuple[DriveSource, ...]
    cursor: str | None
