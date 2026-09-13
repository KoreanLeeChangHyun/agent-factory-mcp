from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.identity.authorization import AuthorizedContext

from .collection_domain import (
    CollectionJob,
    CollectionResult,
    CollectionRun,
    CollectionSelection,
    DriveSourcePage,
    ProviderCollection,
    ProviderInspection,
    SourceItem,
    SourcePage,
)
from .credentials import CredentialConnection


class CollectionRepository(Protocol):
    def guard(
        self, workspace_id: UUID, connection_id: UUID
    ) -> AbstractAsyncContextManager[None]: ...
    async def connection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> CredentialConnection | None: ...
    async def insert_collection(self, value: ProviderCollection) -> ProviderCollection: ...
    async def collections(self, workspace_id: UUID) -> list[ProviderCollection]: ...
    async def collection(
        self, workspace_id: UUID, collection_id: UUID
    ) -> ProviderCollection | None: ...
    async def set_enabled(self, value: ProviderCollection) -> ProviderCollection: ...
    async def find_run(
        self, workspace_id: UUID, collection_id: UUID, key: str
    ) -> CollectionRun | None: ...
    async def insert_run(self, value: CollectionRun) -> CollectionRun: ...
    async def run(
        self, workspace_id: UUID, run_id: UUID, *, lock: bool = False
    ) -> CollectionRun | None: ...
    async def save_run(self, value: CollectionRun) -> CollectionRun: ...
    async def save_collection(self, value: ProviderCollection) -> None: ...
    async def inspection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> ProviderInspection | None: ...
    async def save_inspection(self, value: ProviderInspection) -> None: ...
    async def cancelled(self, workspace_id: UUID, run_id: UUID) -> bool: ...
    async def mark_reference_states(
        self, collection: ProviderCollection, seen: frozenset[str], status: str
    ) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class CollectionJobs(Protocol):
    async def stage(
        self, context: AuthorizedContext, run: CollectionRun
    ) -> tuple[CollectionRun, CollectionJob]: ...
    def publish(self, job: CollectionJob) -> str: ...
    async def record_publication(self, job: CollectionJob, publication_id: str) -> None: ...
    async def authoritative(self, context: AuthorizedContext, job_id: UUID) -> CollectionJob: ...
    async def claim(self, context: AuthorizedContext, job_id: UUID) -> bool: ...
    async def checkpoint(self, job_id: UUID, run: CollectionRun) -> None: ...
    async def reconcile(
        self,
        job_id: UUID,
        status: str,
        *,
        error_code: str | None = None,
        retry_after_seconds: int | None = None,
    ) -> None: ...
    async def retries_exhausted(self, job_id: UUID) -> bool: ...
    async def cancel(self, context: AuthorizedContext, job_id: UUID) -> str: ...
    async def cancellation_requested(self, job_id: UUID) -> bool: ...


class ProviderCollectionDriver(Protocol):
    async def inspect(self) -> dict[str, object]: ...
    async def page(
        self,
        selection: CollectionSelection,
        cursor: dict[str, object],
        remaining: int,
        *,
        metadata_only: bool,
    ) -> SourcePage: ...
    async def browse_drive(
        self, folder_id: str, cursor: str | None, limit: int
    ) -> DriveSourcePage: ...


class CollectionConnections(Protocol):
    async def driver(
        self,
        context: AuthorizedContext,
        connection: CredentialConnection,
        *,
        run: CollectionRun | None = None,
        selection: CollectionSelection | None = None,
    ) -> ProviderCollectionDriver: ...


class CollectionDocuments(Protocol):
    async def persist(
        self,
        context: AuthorizedContext,
        collection: ProviderCollection,
        run: CollectionRun,
        item: SourceItem,
    ) -> CollectionResult: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class CollectionInfrastructureError(Exception):
    """Sanitized failure raised by infrastructure at the application boundary."""
