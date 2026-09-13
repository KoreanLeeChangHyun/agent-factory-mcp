from __future__ import annotations

from dataclasses import replace
from datetime import timedelta
from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import (
    ApplicationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

from .collection_domain import (
    TERMINAL_COLLECTION_STATUSES,
    CollectionMode,
    CollectionResult,
    CollectionRun,
    CollectionRunStatus,
    CollectionSelection,
    DriveSourcePage,
    ProviderCollection,
    ProviderInspection,
)
from .collection_ports import (
    Clock,
    CollectionConnections,
    CollectionDocuments,
    CollectionInfrastructureError,
    CollectionJobs,
    CollectionRepository,
)
from .domain import ConnectionStatus


class CollectionCancelled(Exception):
    pass


class ProviderCollectionUseCases:
    def __init__(
        self,
        repository: CollectionRepository,
        jobs: CollectionJobs,
        connections: CollectionConnections,
        documents: CollectionDocuments,
        clock: Clock,
    ) -> None:
        self.repository = repository
        self.jobs = jobs
        self.connections = connections
        self.documents = documents
        self.clock = clock

    async def create(
        self,
        context: AuthorizedContext,
        connection_id: UUID,
        *,
        name: str,
        selection: CollectionSelection,
        mode: CollectionMode,
    ) -> ProviderCollection:
        require_context(context, "integration.use", "document.import")
        workspace_id = require_workspace_id(context)
        connection = await self.repository.connection(workspace_id, connection_id)
        if connection is None:
            raise NotFoundError("integration_connection_not_found", "Connection not found")
        selection.validate(connection.provider)
        if mode == CollectionMode.REFERENCE:
            require_context(context, "document.create", "document.update")
            if connection.provider != "google-drive":
                raise ApplicationError(
                    "reference_mode_unsupported", "Reference mode is unsupported", 422
                )
        cleaned = name.strip()
        if not cleaned or len(cleaned) > 160:
            raise ApplicationError("invalid_collection_name", "Collection name is required", 422)
        value = ProviderCollection(
            uuid4(),
            workspace_id,
            connection_id,
            connection.provider,
            cleaned,
            selection,
            mode,
            context.principal.user_id,
        )
        try:
            saved = await self.repository.insert_collection(value)
            await self.repository.commit()
            return saved
        except Exception as error:
            await self.repository.rollback()
            if error.__class__.__name__ == "IntegrityError":
                raise ConflictError(
                    "collection_exists", "Collection name already exists"
                ) from error
            raise

    async def list(self, context: AuthorizedContext) -> list[ProviderCollection]:
        require_context(context, "integration.read")
        return await self.repository.collections(require_workspace_id(context))

    async def inspect(
        self, context: AuthorizedContext, connection_id: UUID, *, live: bool = False
    ) -> ProviderInspection:
        require_context(context, "integration.read")
        workspace_id = require_workspace_id(context)
        connection = await self.repository.connection(workspace_id, connection_id)
        if connection is None:
            raise NotFoundError("integration_connection_not_found", "Connection not found")
        cached = await self.repository.inspection(workspace_id, connection_id)
        if not live and cached is not None:
            return replace(
                cached, stale=self.clock.now() - cached.observed_at > timedelta(minutes=5)
            )
        driver = await self.connections.driver(context, connection)
        observed = await driver.inspect()
        grants = observed.get("granted_scopes")
        value = ProviderInspection(
            workspace_id,
            connection_id,
            str(observed.get("health", "unknown")),
            str(observed["account_id"]) if observed.get("account_id") else None,
            cached.requested_scopes if cached else (),
            tuple(str(item) for item in grants) if isinstance(grants, list) else None,
            str(observed.get("scope_support", "supported")),
            self.clock.now(),
            False,
            str(observed["error_code"]) if observed.get("error_code") else None,
        )
        await self.repository.save_inspection(value)
        await self.repository.commit()
        return value

    async def browse_drive(
        self,
        context: AuthorizedContext,
        connection_id: UUID,
        *,
        folder_id: str,
        cursor: str | None = None,
        limit: int = 100,
    ) -> DriveSourcePage:
        require_context(context, "integration.read", "integration.use")
        if not 1 <= limit <= 100 or not folder_id.strip():
            raise ApplicationError("invalid_drive_browse", "Drive browse request is invalid", 422)
        workspace_id = require_workspace_id(context)
        connection = await self.repository.connection(workspace_id, connection_id)
        if connection is None or connection.provider != "google-drive":
            raise NotFoundError("integration_connection_not_found", "Connection not found")
        driver = await self.connections.driver(context, connection)
        observation = await driver.inspect()
        grants = observation.get("granted_scopes")
        if not isinstance(grants, list):
            raise ConflictError("granted_scopes_unknown", "Provider grants are unavailable")
        if "https://www.googleapis.com/auth/drive.readonly" not in {str(item) for item in grants}:
            raise ConflictError("provider_scope_missing", "Provider scope is missing")
        return await driver.browse_drive(folder_id, cursor, limit)

    async def results(
        self, context: AuthorizedContext, run_id: UUID
    ) -> tuple[CollectionResult, ...]:
        run = await self.status(context, run_id)
        return tuple(run.results)

    async def enable(
        self, context: AuthorizedContext, collection_id: UUID, *, enabled: bool
    ) -> ProviderCollection:
        require_context(context, "integration.update")
        value = await self._collection(context, collection_id)
        saved = await self.repository.set_enabled(replace(value, enabled=enabled))
        await self.repository.commit()
        return saved

    async def start(
        self, context: AuthorizedContext, collection_id: UUID, request_key: str
    ) -> CollectionRun:
        require_context(context, "integration.use", "document.import")
        if not request_key.strip() or len(request_key) > 160:
            raise ApplicationError("invalid_request_key", "Request key is invalid", 422)
        collection = await self._collection(context, collection_id)
        if not collection.enabled:
            raise ConflictError("collection_unlinked", "Collection is disabled")
        if collection.mode == CollectionMode.REFERENCE:
            require_context(context, "document.create", "document.update")
        async with self.repository.guard(collection.workspace_id, collection.connection_id):
            try:
                run = await self.repository.find_run(
                    collection.workspace_id, collection.id, request_key
                )
                if run is None:
                    run = await self.repository.insert_run(
                        CollectionRun(
                            uuid4(),
                            collection.workspace_id,
                            collection.id,
                            context.principal.user_id,
                            request_key,
                            CollectionRunStatus.QUEUED,
                        )
                    )
                if run.requested_by_user_id != context.principal.user_id:
                    raise PermissionDeniedError(
                        "run_owner_mismatch", "Request key belongs to another user"
                    )
                if run.status not in TERMINAL_COLLECTION_STATUSES and run.job_id is None:
                    run, job = await self.jobs.stage(context, run)
                    await self.repository.save_run(run)
                    await self.repository.commit()
                    publication_id = self.jobs.publish(job)
                    await self.jobs.record_publication(job, publication_id)
                    await self.repository.commit()
                return run
            except Exception:
                await self.repository.rollback()
                raise

    async def status(self, context: AuthorizedContext, run_id: UUID) -> CollectionRun:
        require_context(context, "integration.read")
        run = await self.repository.run(require_workspace_id(context), run_id)
        if run is None:
            raise NotFoundError("collection_run_not_found", "Collection run not found")
        return run

    async def cancel(self, context: AuthorizedContext, run_id: UUID) -> CollectionRun:
        require_context(context, "integration.use", "job.cancel")
        run = await self.status(context, run_id)
        if run.status in TERMINAL_COLLECTION_STATUSES:
            return run
        run = await self.repository.save_run(replace(run, cancel_requested=True))
        await self.repository.commit()
        if run.job_id and await self.jobs.cancel(context, run.job_id) == "cancelled":
            run = await self.repository.save_run(
                replace(run, status=CollectionRunStatus.CANCELLED, finished_at=self.clock.now())
            )
            await self.repository.commit()
        return run

    async def execute(
        self,
        context: AuthorizedContext,
        run_id: UUID,
        *,
        job_id: UUID,
    ) -> CollectionRun:
        require_context(context, "integration.use", "document.import")
        workspace_id = require_workspace_id(context)
        run = await self.repository.run(workspace_id, run_id, lock=True)
        if run is None or run.requested_by_user_id != context.principal.user_id:
            raise PermissionDeniedError(
                "run_owner_mismatch", "Worker requester does not own this run"
            )
        job = await self.jobs.authoritative(context, job_id)
        if (
            job.workspace_id != workspace_id
            or job.organization_id != context.scope.organization_id
            or job.requested_by_user_id != context.principal.user_id
            or job.task_type != "integration.sync"
            or job.status not in {"running", "cancel_requested"}
            or job.payload != {"collection_run_id": str(run_id)}
            or job.idempotency_key != f"collection:{run_id}"
            or (run.job_id is not None and run.job_id != job_id)
        ):
            raise PermissionDeniedError("job_context_mismatch", "Job does not match collection run")
        if run.status in TERMINAL_COLLECTION_STATUSES:
            return run
        collection = await self._collection(context, run.collection_id)
        if not collection.enabled:
            raise ConflictError("collection_unlinked", "Collection is disabled")
        if not await self.jobs.claim(context, job_id):
            raise ConflictError("collection_job_claimed", "Collection Job is already claimed")
        async with self.repository.guard(collection.workspace_id, collection.connection_id):
            run = await self.repository.run(workspace_id, run_id, lock=True)
            assert run is not None
            if run.status in TERMINAL_COLLECTION_STATUSES:
                return run
            if (
                job.status == "cancel_requested"
                or run.cancel_requested
                or await self.repository.cancelled(workspace_id, run.id)
                or await self.jobs.cancellation_requested(job_id)
            ):
                run = await self.repository.save_run(
                    replace(run, status=CollectionRunStatus.CANCELLED, finished_at=self.clock.now())
                )
                await self.repository.save_collection(
                    replace(
                        collection,
                        last_refresh_status=run.status,
                        last_refreshed_at=run.finished_at,
                    )
                )
                await self.repository.commit()
                await self.jobs.reconcile(job_id, run.status.value)
                return run
            try:
                run = await self.repository.save_run(
                    replace(run, job_id=job_id, status=CollectionRunStatus.RUNNING, error_code=None)
                )
                # Release the run-row claim before provider I/O so cancellation can
                # commit independently while the connection guard remains held.
                await self.repository.commit()
            except CollectionInfrastructureError:
                return await self._unexpected_failure(collection, run, job_id)
            connection = await self.repository.connection(workspace_id, collection.connection_id)
            if connection is None or connection.status != ConnectionStatus.ACTIVE:
                return await self._failure(
                    collection,
                    run,
                    job_id,
                    ConflictError("connection_not_active", "Connection is not active"),
                )
            selection = collection.selection.validate(collection.provider)
            try:
                driver = await self.connections.driver(
                    context, connection, run=run, selection=selection
                )
                observation = await driver.inspect()
            except ApplicationError as error:
                if error.code == "collection_cancelled":
                    return await self._cancel(collection, run, job_id)
                return await self._failure(collection, run, job_id, error)
            except CollectionInfrastructureError:
                return await self._unexpected_failure(collection, run, job_id)
            if (
                observation.get("error_code") == "collection_cancelled"
                or await self.repository.cancelled(workspace_id, run.id)
                or await self.jobs.cancellation_requested(job_id)
            ):
                return await self._cancel(collection, run, job_id)
            if observation.get("health") != "available":
                health_error = ApplicationError(
                    str(observation.get("error_code", "connection_health_unknown")),
                    "Provider connection is unavailable",
                    502,
                    {
                        "retryable": bool(observation.get("retryable")),
                        "retry_after": observation.get("retry_after"),
                    },
                )
                return await self._failure(collection, run, job_id, health_error)
            required = self._required_scopes(collection)
            granted = observation.get("granted_scopes")
            scope_support = observation.get("scope_support", "supported")
            if scope_support != "unsupported" and required:
                if not isinstance(granted, list):
                    return await self._failure(
                        collection,
                        run,
                        job_id,
                        ConflictError("granted_scopes_unknown", "Provider grants are unavailable"),
                    )
                if required - {str(item) for item in granted}:
                    return await self._failure(
                        collection,
                        run,
                        job_id,
                        ConflictError("provider_scope_missing", "Provider scope is missing"),
                    )
            while run.examined < selection.max_items and run.pages < selection.max_pages:
                if (
                    run.cancel_requested
                    or await self.repository.cancelled(workspace_id, run.id)
                    or await self.jobs.cancellation_requested(job_id)
                ):
                    run = replace(
                        run, status=CollectionRunStatus.CANCELLED, finished_at=self.clock.now()
                    )
                    break
                refreshed = await self.repository.connection(workspace_id, collection.connection_id)
                if refreshed is None or refreshed.status != ConnectionStatus.ACTIVE:
                    return await self._failure(
                        collection,
                        run,
                        job_id,
                        ConflictError("connection_not_active", "Connection is not active"),
                    )
                # The connection adapter decrypts/refreshes credentials at this boundary;
                # never retain provider tokens across page checkpoints.
                try:
                    driver = await self.connections.driver(
                        context, refreshed, run=run, selection=selection
                    )
                    refreshed_observation = await driver.inspect()
                except ApplicationError as error:
                    if error.code == "collection_cancelled":
                        return await self._cancel(collection, run, job_id)
                    return await self._failure(collection, run, job_id, error)
                except CollectionInfrastructureError:
                    return await self._unexpected_failure(collection, run, job_id)
                if (
                    refreshed_observation.get("error_code") == "collection_cancelled"
                    or await self.repository.cancelled(workspace_id, run.id)
                    or await self.jobs.cancellation_requested(job_id)
                ):
                    return await self._cancel(collection, run, job_id)
                if refreshed_observation.get("health") != "available":
                    health_error = ApplicationError(
                        str(refreshed_observation.get("error_code", "connection_health_unknown")),
                        "Provider connection is unavailable",
                        502,
                        {
                            "retryable": bool(refreshed_observation.get("retryable")),
                            "retry_after": refreshed_observation.get("retry_after"),
                        },
                    )
                    return await self._failure(collection, run, job_id, health_error)
                try:
                    page = await driver.page(
                        selection,
                        dict(run.cursor),
                        selection.max_items - run.examined,
                        metadata_only=collection.mode == CollectionMode.REFERENCE,
                    )
                except ApplicationError as error:
                    if error.code == "collection_cancelled":
                        return await self._cancel(collection, run, job_id)
                    return await self._failure(collection, run, job_id, error)
                except CollectionInfrastructureError:
                    return await self._unexpected_failure(collection, run, job_id)
                if await self.repository.cancelled(
                    workspace_id, run.id
                ) or await self.jobs.cancellation_requested(job_id):
                    return await self._cancel(collection, run, job_id)
                if page.examined > selection.max_items - run.examined:
                    return await self._failure(
                        collection,
                        run,
                        job_id,
                        ConflictError("provider_exceeded_page_bound", "Provider exceeded bounds"),
                    )
                if page.bytes_read > selection.max_bytes - run.bytes_read:
                    return await self._failure(
                        collection,
                        run,
                        job_id,
                        ConflictError(
                            "provider_response_too_large", "Provider exceeded byte limit"
                        ),
                    )
                results = {result.source_id: result for result in run.results}
                for item in page.items:
                    if await self.repository.cancelled(
                        workspace_id, run.id
                    ) or await self.jobs.cancellation_requested(job_id):
                        run = replace(
                            run,
                            status=CollectionRunStatus.CANCELLED,
                            finished_at=self.clock.now(),
                        )
                        break
                    try:
                        persisted = await self.documents.persist(context, collection, run, item)
                    except ApplicationError as error:
                        return await self._failure(collection, run, job_id, error)
                    except CollectionInfrastructureError:
                        return await self._unexpected_failure(collection, run, job_id)
                    results[persisted.source_id] = persisted
                    try:
                        run = await self.repository.save_run(
                            replace(run, results=tuple(results.values()))
                        )
                        await self.repository.commit()
                    except CollectionInfrastructureError:
                        return await self._unexpected_failure(collection, run, job_id)
                if run.status == CollectionRunStatus.CANCELLED:
                    break
                if not page.done and page.cursor == run.cursor:
                    return await self._failure(
                        collection,
                        run,
                        job_id,
                        ConflictError("provider_cursor_stalled", "Provider cursor did not advance"),
                    )
                status = CollectionRunStatus.RUNNING
                finished = None
                examined, pages = run.examined + page.examined, run.pages + 1
                if page.done:
                    status, finished = CollectionRunStatus.SUCCEEDED, self.clock.now()
                elif examined >= selection.max_items or pages >= selection.max_pages:
                    status, finished = CollectionRunStatus.BOUNDED, self.clock.now()
                try:
                    run = await self.repository.save_run(
                        replace(
                            run,
                            cursor=dict(page.cursor),
                            examined=examined,
                            pages=pages,
                            bytes_read=run.bytes_read + page.bytes_read,
                            status=status,
                            finished_at=finished,
                        )
                    )
                    await self.repository.commit()
                    await self.jobs.checkpoint(job_id, run)
                except CollectionInfrastructureError:
                    return await self._unexpected_failure(collection, run, job_id)
                if status in TERMINAL_COLLECTION_STATUSES:
                    break
            if run.status == CollectionRunStatus.RUNNING:
                run = replace(run, status=CollectionRunStatus.BOUNDED, finished_at=self.clock.now())
            if (
                collection.mode == CollectionMode.REFERENCE
                and run.status == CollectionRunStatus.SUCCEEDED
            ):
                await self.repository.mark_reference_states(
                    collection, frozenset(result.source_id for result in run.results), "missing"
                )
            try:
                await self.repository.save_run(run)
                await self.repository.save_collection(
                    replace(
                        collection,
                        last_refresh_status=run.status,
                        last_refreshed_at=run.finished_at,
                        last_error_code=run.error_code,
                    )
                )
                await self.repository.commit()
            except CollectionInfrastructureError:
                return await self._unexpected_failure(collection, run, job_id)
            await self.jobs.reconcile(job_id, run.status.value, error_code=run.error_code)
            return run

    async def _cancel(
        self, collection: ProviderCollection, run: CollectionRun, job_id: UUID
    ) -> CollectionRun:
        cancelled = await self.repository.save_run(
            replace(run, status=CollectionRunStatus.CANCELLED, finished_at=self.clock.now())
        )
        await self.repository.save_collection(
            replace(
                collection,
                last_refresh_status=cancelled.status,
                last_refreshed_at=cancelled.finished_at,
                last_error_code=None,
            )
        )
        await self.repository.commit()
        await self.jobs.reconcile(job_id, cancelled.status.value)
        return cancelled

    async def _failure(
        self,
        collection: ProviderCollection,
        run: CollectionRun,
        job_id: UUID,
        error: ApplicationError,
    ) -> CollectionRun:
        retryable = bool(getattr(error, "retryable", False)) or bool(error.details.get("retryable"))
        retries_exhausted = retryable and await self.jobs.retries_exhausted(job_id)
        retry_after = getattr(error, "retry_after", error.details.get("retry_after"))
        if not isinstance(retry_after, int) or not 0 <= retry_after <= 86_400:
            retry_after = None
        next_status = (
            CollectionRunStatus.RETRY
            if retryable and not retries_exhausted
            else CollectionRunStatus.FAILED
        )
        run = await self.repository.save_run(
            replace(
                run,
                status=next_status,
                error_code=error.code,
                finished_at=None if next_status == CollectionRunStatus.RETRY else self.clock.now(),
            )
        )
        await self.repository.save_collection(
            replace(collection, last_refresh_status=next_status, last_error_code=error.code)
        )
        if collection.mode == CollectionMode.REFERENCE and error.code in {
            "provider_forbidden",
            "provider_not_found",
        }:
            await self.repository.mark_reference_states(collection, frozenset(), "inaccessible")
        await self.repository.commit()
        await self.jobs.reconcile(
            job_id,
            "dead" if retries_exhausted else next_status.value,
            error_code=error.code,
            retry_after_seconds=retry_after if next_status == CollectionRunStatus.RETRY else None,
        )
        return run

    async def _unexpected_failure(
        self,
        collection: ProviderCollection,
        run: CollectionRun,
        job_id: UUID,
    ) -> CollectionRun:
        await self.repository.rollback()
        authoritative = await self.repository.run(collection.workspace_id, run.id, lock=True)
        if authoritative is None:
            authoritative = run
        return await self._failure(
            collection,
            authoritative,
            job_id,
            ApplicationError(
                "collection_persistence_error",
                "Collection processing could not be completed",
                503,
                {"retryable": True},
            ),
        )

    async def _collection(
        self, context: AuthorizedContext, collection_id: UUID
    ) -> ProviderCollection:
        value = await self.repository.collection(require_workspace_id(context), collection_id)
        if value is None:
            raise NotFoundError("collection_not_found", "Collection not found")
        return value

    @staticmethod
    def _required_scopes(collection: ProviderCollection) -> set[str]:
        selection = collection.selection
        if collection.provider == "google-drive":
            return {"https://www.googleapis.com/auth/drive.readonly"}
        if collection.provider == "gmail":
            return {"https://www.googleapis.com/auth/gmail.readonly"}
        if collection.provider == "onedrive":
            return {"Files.Read.All" if selection.values.get("include_shared") else "Files.Read"}
        if collection.provider == "slack":
            channel = {
                "public": "channels:history",
                "private": "groups:history",
                "im": "im:history",
                "mpim": "mpim:history",
            }[str(selection.values["channel_type"])]
            return {channel} | ({"files:read"} if selection.attachments else set())
        return set()
