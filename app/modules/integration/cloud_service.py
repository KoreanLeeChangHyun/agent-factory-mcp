"""Bounded collection execution into source-faithful Original revisions."""

import io
import json
import re
import zipfile
from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError, PermissionDeniedError
from app.modules.document.models import DocumentStatus, DocumentType
from app.modules.document.service import ALLOWED_MEDIA_TYPES
from app.modules.integration.cloud_http import CollectionCancelled, ProviderError
from app.modules.integration.cloud_models import (
    CloudCollection,
    CloudCollectionRun,
    CloudSourceMapping,
)
from app.modules.integration.cloud_providers import CloudDriver, evidence
from app.modules.integration.cloud_schemas import Selection, required_scopes
from app.modules.integration.models import ConnectionStatus
from app.modules.schedule.models import JobStatus

TERMINAL = {'succeeded', 'bounded', 'cancelled', 'failed'}


def require(context, *permissions):
    if any(permission not in context.permissions for permission in permissions):
        raise PermissionDeniedError('permission_required', 'Collection operation requires additional workspace permissions')


def safe_name(value):
    name = re.sub(r'[\\/\x00-\x1f\x7f]', '_', str(value)).strip('. ')[:180]
    return name or 'source'


def representation(item):
    """ZIP is a lossless source package for multipart or non-allowlisted MIME.

    Fixed ZIP timestamps make replay content-addressable; native bytes and MIME
    declarations are retained, without mislabelling EML/XLSX as plain text.
    """
    artifacts = item.artifacts
    if len(artifacts) == 1 and artifacts[0].media_type in ALLOWED_MEDIA_TYPES and artifacts[0].content:
        artifact = artifacts[0]
        return safe_name(artifact.filename), artifact.media_type, artifact.content
    stream = io.BytesIO()
    manifest = []
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_STORED) as archive:
        for i, artifact in enumerate(artifacts):
            path = f'{i:03d}-{safe_name(artifact.filename)}'
            archive.writestr(zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0)), artifact.content)
            manifest.append({'path': path, 'original_filename': artifact.filename, 'media_type': artifact.media_type,
                             'size': len(artifact.content), 'sha256': sha256(artifact.content).hexdigest()})
        archive.writestr(zipfile.ZipInfo('manifest.json', date_time=(1980, 1, 1, 0, 0, 0)),
                         json.dumps(manifest, sort_keys=True).encode())
    return safe_name(item.title) + '.zip', 'application/zip', stream.getvalue()


class CloudCollectionService:
    def __init__(self, repository, connections, documents, schedules):
        self.repository, self.connections, self.documents, self.schedules = repository, connections, documents, schedules
        self.context = repository.context

    async def create(self, request):
        require(self.context, 'integration.use', 'document.import')
        connection, provider = await self.connections.resolve(request.connection_id)
        selection = request.selection.for_provider(provider)
        if request.mode == 'reference' and provider != 'google-drive':
            raise ProviderError('reference_mode_unsupported')
        if request.mode == 'reference':
            require(self.context, 'document.create', 'document.update')
        if not request.name.strip():
            raise ProviderError('invalid_collection_name')
        record = CloudCollection(id=uuid4(), workspace_id=self.repository.workspace_id,
                                 connection_id=connection.id, provider=provider, name=request.name.strip(),
                                 selection=selection.model_dump(exclude_unset=True),
                                 mode=request.mode, is_enabled=True,
                                 created_by_user_id=self.context.principal.user_id)
        try:
            await self.repository.save(record)
        except IntegrityError:
            await self.repository.rollback()
            raise ConflictError('collection_exists', 'Collection name already exists for this connection') from None
        return self.collection_projection(record)

    @staticmethod
    def collection_projection(record):
        return {'collection_id': str(record.id), 'connection_id': str(record.connection_id), 'provider': record.provider,
                'name': record.name, 'selection': record.selection, 'mode': record.mode,
                'enabled': record.is_enabled, 'last_refresh_status': record.last_refresh_status,
                'last_refreshed_at': record.last_refreshed_at.isoformat() if record.last_refreshed_at else None,
                'last_error_code': record.last_error_code,
                'destination': f'workspace:{record.workspace_id}:original'}

    async def list(self):
        require(self.context, 'integration.read')
        await self.repository.scope()
        records = await self.repository.session.scalars(select(CloudCollection).where(
            CloudCollection.workspace_id == self.repository.workspace_id).order_by(CloudCollection.created_at).limit(1000))
        return {'collections': [self.collection_projection(record) for record in records]}

    async def sources(self, collection_id):
        require(self.context, 'integration.read', 'document.read')
        await self.repository.one(CloudCollection, collection_id)
        rows = await self.repository.list_mappings(collection_id)
        return {'sources': [{
            'source_id': row.source_id, 'document_id': str(row.document_id),
            'source_url': row.source_url, 'metadata': row.source_metadata,
            'status': row.source_status,
            'last_seen_at': row.last_seen_at.isoformat() if row.last_seen_at else None,
        } for row in rows]}

    async def start(self, collection_id, request_key):
        require(self.context, 'integration.use', 'document.import')
        if not isinstance(request_key, str) or not 1 <= len(request_key) <= 160:
            raise ProviderError('invalid_request_key')
        collection = await self.repository.one(CloudCollection, collection_id)
        if not collection.is_enabled:
            raise ConflictError('collection_unlinked', 'Collection is unlinked from this workspace')
        if collection.mode == 'reference':
            require(self.context, 'document.create', 'document.update')
        async with self.repository.guard(collection.connection_id):
            run = await self.repository.find_run(collection_id, request_key)
            if run is None:
                run = CloudCollectionRun(id=uuid4(), workspace_id=self.repository.workspace_id,
                                         collection_id=collection_id, requested_by_user_id=self.context.principal.user_id,
                                         request_key=request_key, status='queued', cursor={}, results=[],
                                         examined=0, pages=0, bytes_read=0, cancel_requested=False)
                await self.repository.save(run)
            if run.requested_by_user_id != self.context.principal.user_id:
                raise PermissionDeniedError('run_owner_mismatch', 'Request key belongs to another requester')
            if run.status not in TERMINAL and run.job_id is None:
                await self.repository.scope()
                job = await self.schedules.enqueue(self.context, 'integration.sync', 'integrations',
                                                   {'collection_run_id': str(run.id)}, f'collection:{run.id}')
                run.job_id = job.id
                await self.repository.save(run)
            return self.run_projection(run)

    async def set_enabled(self, collection_id, enabled):
        require(self.context, 'integration.update')
        collection = await self.repository.one(CloudCollection, collection_id)
        collection.is_enabled = bool(enabled)
        await self.repository.save(collection)
        return self.collection_projection(collection)

    @staticmethod
    def run_projection(run, *, results=False):
        payload = {'run_id': str(run.id), 'collection_id': str(run.collection_id), 'status': run.status,
                   'job_id': str(run.job_id) if run.job_id else None, 'examined': run.examined, 'pages': run.pages,
                   'bytes_read': run.bytes_read, 'persisted_items': len(run.results),
                   'cancel_requested': run.cancel_requested, 'error_code': run.error_code,
                   'finished_at': run.finished_at.isoformat() if run.finished_at else None}
        if results:
            payload['results'] = run.results
        return payload

    async def status(self, run_id, *, results=False):
        require(self.context, 'integration.read')
        run = await self.repository.one(CloudCollectionRun, run_id)
        return self.run_projection(run, results=results)

    async def cancel(self, run_id):
        require(self.context, 'integration.use', 'job.cancel')
        run = await self.repository.one(CloudCollectionRun, run_id)
        if run.status in TERMINAL:
            return self.run_projection(run)
        # Only update cancellation columns; never overwrite a concurrent cursor.
        await self.repository.session.execute(update(CloudCollectionRun).where(
            CloudCollectionRun.id == run_id, CloudCollectionRun.workspace_id == self.repository.workspace_id
        ).values(cancel_requested=True))
        await self.repository.commit()
        if run.job_id:
            await self.repository.scope()
            job = await self.schedules.cancel(self.context, run.job_id, ignore_terminal=True)
            if job.status == JobStatus.CANCELLED:
                await self.repository.session.execute(update(CloudCollectionRun).where(
                    CloudCollectionRun.id == run_id, CloudCollectionRun.workspace_id == self.repository.workspace_id
                ).values(status='cancelled', finished_at=datetime.now(UTC)))
                await self.repository.commit()
        return await self.status(run_id)

    async def persist_item(self, collection, run, item):
        filename, media_type, content = representation(item)
        digest = sha256(content).hexdigest()
        identity = sha256(f'{collection.id}:{item.source_id}'.encode()).hexdigest()
        slug = 'gather-' + identity
        metadata = {'gather': {'provider': collection.provider, 'connection_id': str(collection.connection_id),
                              'collection_id': str(collection.id), 'source_id': item.source_id,
                              'selection': collection.selection, 'source': evidence(item.metadata),
                              'limitations': item.limitations}, 'documentType': 'original'}
        mapping = await self.repository.mapping(collection.id, item.source_id)
        if mapping is None:
            # Recover a document committed just before a prior worker died.
            document = await self.repository.document_by_slug(slug)
            if document is not None and (document.deleted_at is not None or document.document_type != DocumentType.ORIGINAL
                                        or document.document_metadata.get('gather', {}).get('source_id') != item.source_id
                                        or document.document_metadata.get('gather', {}).get('collection_id') != str(collection.id)):
                raise ProviderError('source_document_conflict')
            if document is None:
                await self.repository.scope()
                document = await self.documents.create(self.context, item.title[:300] or item.source_id,
                                                       slug, DocumentType.ORIGINAL, metadata)
            mapping = CloudSourceMapping(workspace_id=self.repository.workspace_id, collection_id=collection.id,
                                         source_id=item.source_id, document_id=document.id)
            await self.repository.save(mapping)
        await self.repository.scope()
        revisions = await self.documents.list_revisions(self.context, mapping.document_id)
        # Only the newest revision can make this refresh unchanged (A->B->A is a new revision).
        latest = max(revisions, key=lambda revision: revision.revision_number) if revisions else None
        revision_metadata = {**metadata, 'retrieved_at': datetime.now(UTC).isoformat(), 'collection_run_id': str(run.id)}
        metadata_digest = sha256(json.dumps(metadata, sort_keys=True).encode()).hexdigest()
        revision_metadata['source_metadata_hash'] = metadata_digest
        if latest and latest.sha256 == digest and latest.revision_metadata.get('source_metadata_hash') == metadata_digest:
            revision = latest
            changed = False
        else:
            await self.connections.http.check_cancelled()
            await self.repository.scope()
            revision = await self.documents.add_revision(self.context, mapping.document_id, filename, media_type,
                                                         content, revision_metadata)
            changed = True
        mapping.content_hash, mapping.revision_number = digest, revision.revision_number
        await self.repository.save(mapping)
        return {'source_id': item.source_id, 'document_id': str(mapping.document_id),
                'revision_number': revision.revision_number, 'sha256': digest,
                'changed': changed, 'limitations': item.limitations}

    async def persist_reference(self, collection, run, item):
        source = evidence(item.metadata)
        link = source.get('webViewLink') or f'https://drive.google.com/open?id={item.source_id}'
        digest_source = {key: source.get(key) for key in (
            'id', 'name', 'mimeType', 'createdTime', 'modifiedTime', 'md5Checksum',
            'size', 'fileExtension', 'webViewLink', 'parents'
        ) if source.get(key) is not None}
        digest = sha256(json.dumps(digest_source, sort_keys=True).encode()).hexdigest()
        extension = source.get('fileExtension') or (item.title.rsplit('.', 1)[-1] if '.' in item.title else '')
        identity = sha256(f'{collection.connection_id}:{item.source_id}'.encode()).hexdigest()
        slug = 'gather-' + identity
        mapping = await self.repository.mapping(collection.id, item.source_id)
        document = None
        metadata: dict[str, object]
        if mapping is None:
            document = await self.repository.document_by_slug(slug)
            if document is not None and (document.deleted_at is not None or document.document_type != DocumentType.ORIGINAL
                                        or document.document_metadata.get('gather', {}).get('source_id') != item.source_id
                                        or document.document_metadata.get('gather', {}).get('connection_id') != str(collection.connection_id)):
                raise ProviderError('source_document_conflict')
            collection_ids = set(document.document_metadata.get('gather', {}).get('collection_ids', [])) if document else set()
            collection_ids.add(str(collection.id))
            metadata = {
                'documentType': 'original', 'classification': '원본 문서', 'provider': 'Google Drive',
                'tags': [], 'extension': extension, 'source_url': link,
                'gather': {
                    'provider': collection.provider, 'connection_id': str(collection.connection_id),
                    'collection_ids': sorted(collection_ids), 'source_id': item.source_id,
                    'source': digest_source, 'mode': 'reference', 'body_stored': False,
                    'source_status': 'active', 'last_seen_at': datetime.now(UTC).isoformat(),
                },
            }
            if document is None:
                await self.repository.scope()
                document = await self.documents.create(self.context, item.title[:300] or item.source_id,
                                                       slug, DocumentType.ORIGINAL, metadata)
            mapping = CloudSourceMapping(workspace_id=self.repository.workspace_id, collection_id=collection.id,
                                         source_id=item.source_id, document_id=document.id)
        else:
            document = await self.documents.get(self.context, mapping.document_id)
            collection_ids = set(document.document_metadata.get('gather', {}).get('collection_ids', []))
            collection_ids.add(str(collection.id))
            metadata = {
                'documentType': 'original', 'classification': '원본 문서', 'provider': 'Google Drive',
                'tags': [], 'extension': extension, 'source_url': link,
                'gather': {
                    'provider': collection.provider, 'connection_id': str(collection.connection_id),
                    'collection_ids': sorted(collection_ids), 'source_id': item.source_id,
                    'source': digest_source, 'mode': 'reference', 'body_stored': False,
                    'source_status': 'active', 'last_seen_at': datetime.now(UTC).isoformat(),
                },
            }
        changed = mapping.metadata_hash != digest or document.title != item.title or mapping.source_status != 'active'
        if changed and document.document_metadata != metadata:
            await self.documents.update(self.context, document.id, item.title[:300] or item.source_id,
                                        DocumentStatus.ACTIVE, metadata, document.revision)
        mapping.source_url, mapping.source_metadata = link, digest_source
        mapping.metadata_hash, mapping.source_status = digest, 'active'
        mapping.last_seen_at = datetime.now(UTC)
        await self.repository.save(mapping)
        return {'source_id': item.source_id, 'document_id': str(mapping.document_id), 'source_url': link,
                'revision_number': None, 'sha256': None, 'changed': changed, 'body_stored': False,
                'limitations': item.limitations}

    async def mark_missing_references(self, collection, seen):
        for mapping in await self.repository.list_mappings(collection.id):
            if mapping.source_id in seen or mapping.source_status == 'missing':
                continue
            mapping.source_status = 'missing'
            await self.repository.save(mapping)
            if await self.repository.has_active_mapping(mapping.document_id, mapping.id):
                continue
            document = await self.documents.get(self.context, mapping.document_id)
            metadata = dict(document.document_metadata)
            gather = dict(metadata.get('gather', {}))
            gather['source_status'] = 'missing'
            metadata['gather'] = gather
            await self.documents.update(self.context, document.id, document.title, DocumentStatus.ACTIVE,
                                        metadata, document.revision)

    async def mark_inaccessible_references(self, collection):
        for mapping in await self.repository.list_mappings(collection.id):
            mapping.source_status = 'inaccessible'
            await self.repository.save(mapping)
            if await self.repository.has_active_mapping(mapping.document_id, mapping.id):
                continue
            document = await self.documents.get(self.context, mapping.document_id)
            metadata = dict(document.document_metadata)
            gather = dict(metadata.get('gather', {}))
            gather['source_status'] = 'inaccessible'
            metadata['gather'] = gather
            await self.documents.update(self.context, document.id, document.title, DocumentStatus.ACTIVE,
                                        metadata, document.revision)

    async def execute(self, run_id, *, job_id, cancelled):
        require(self.context, 'integration.use', 'document.import')
        run = await self.repository.one(CloudCollectionRun, run_id)
        if run.requested_by_user_id != self.context.principal.user_id:
            raise PermissionDeniedError('run_owner_mismatch', 'Worker requester does not own this run')
        # The job is read with trusted tenant context; payload contributes no authority.
        await self.repository.scope()
        job = await self.schedules.get_job(self.context, job_id)
        if (job.workspace_id != self.repository.workspace_id or job.organization_id != self.context.scope.organization_id
                or job.requested_by_user_id != self.context.principal.user_id or job.task_type != 'integration.sync'
                or job.status not in (JobStatus.RUNNING, JobStatus.CANCEL_REQUESTED)
                or job.payload != {'collection_run_id': str(run_id)}
                or job.idempotency_key != f'collection:{run_id}' or (run.job_id and run.job_id != job_id)):
            raise PermissionDeniedError('job_context_mismatch', 'Worker job does not match collection run')
        collection = await self.repository.one(CloudCollection, run.collection_id)
        if not collection.is_enabled:
            raise ConflictError('collection_unlinked', 'Collection is unlinked from this workspace')
        if collection.mode == 'reference':
            require(self.context, 'document.create', 'document.update')
        async with self.repository.guard(collection.connection_id):
            run = await self.repository.one(CloudCollectionRun, run_id)
            if run.status in TERMINAL:
                return self.run_projection(run, results=True)
            run.job_id = job_id
            selection = Selection.model_validate(collection.selection).for_provider(collection.provider)
            http = self.connections.http
            async def cancellation():
                return await cancelled() or await self.repository.cancelled(run_id)
            http.cancelled = cancellation
            http.max_bytes = max(0, selection.max_bytes - run.bytes_read)
            http.bytes_read = 0
            byte_baseline = run.bytes_read
            async def account_bytes(consumed_or_reserved):
                # An absolute total avoids double charging on page saves/retries.
                run.bytes_read = byte_baseline + consumed_or_reserved
                await self.repository.save(run)
            http.account_bytes = account_bytes
            try:
                await http.check_cancelled()
                connection, provider = await self.connections.resolve(collection.connection_id)
                if provider != collection.provider or connection.status != ConnectionStatus.ACTIVE:
                    raise ProviderError('connection_not_active')
                credentials = await self.connections.refresh(connection, provider)
                observation = await CloudDriver(provider, http, credentials).inspect()
                if observation['health'] == 'unavailable' and observation.get('error_code') == 'provider_unauthorized':
                    credentials = await self.connections.refresh(connection, provider, force=True)
                    observation = await CloudDriver(provider, http, credentials).inspect()
                state = await self.repository.state(connection.id)
                state.inspection, state.inspected_at = observation, datetime.now(UTC)
                if observation.get('granted_scopes') is not None:
                    state.granted_scopes = observation['granted_scopes']
                await self.repository.save(state)
                required = set(required_scopes(provider, selection))
                granted = state.granted_scopes
                if observation['health'] != 'available':
                    raise ProviderError(observation.get('error_code', 'connection_health_unknown'), retryable=observation.get('retryable', False),
                                        retry_after=observation.get('retry_after', 0))
                if required and granted is None:
                    raise ProviderError('granted_scopes_unknown')
                if granted is not None and (required - set(granted) or set(granted) - set(state.requested_scopes)):
                    raise ProviderError('scope_boundary_mismatch')
                run.status, run.error_code = 'running', None
                await self.repository.save(run)
                while run.examined < selection.max_items and run.pages < selection.max_pages:
                    await http.check_cancelled()
                    # Refresh between pages as well; credentials stay server-side.
                    credentials = await self.connections.refresh(connection, provider)
                    page = await CloudDriver(provider, http, credentials).page(
                        selection, run.cursor, selection.max_items - run.examined,
                        metadata_only=collection.mode == 'reference')
                    if page.examined > selection.max_items - run.examined:
                        raise ProviderError('provider_exceeded_page_bound')
                    page_results = []
                    for item in page.items:
                        await http.check_cancelled()
                        persisted = (await self.persist_reference(collection, run, item)
                                     if collection.mode == 'reference'
                                     else await self.persist_item(collection, run, item))
                        page_results.append(persisted)
                        # Expose committed Originals even when cancellation interrupts
                        # a page. The cursor stays at the last complete page.
                        committed = {r['source_id']: r for r in run.results}
                        committed[persisted['source_id']] = persisted
                        run.results = list(committed.values())
                        await self.repository.save(run)
                    await http.check_cancelled()
                    if not page.done and page.cursor == run.cursor:
                        raise ProviderError('provider_cursor_stalled')
                    # Cursor and result checkpoint commit only after all item revisions.
                    by_source = {r['source_id']: r for r in run.results}
                    by_source.update({r['source_id']: r for r in page_results})
                    run.results = list(by_source.values())
                    run.cursor = page.cursor
                    run.examined += page.examined
                    run.pages += 1
                    if page.done:
                        run.status, run.finished_at = 'succeeded', datetime.now(UTC)
                    elif run.examined >= selection.max_items or run.pages >= selection.max_pages:
                        run.status, run.finished_at = 'bounded', datetime.now(UTC)
                    await self.repository.save(run)
                    if run.status in TERMINAL:
                        break
                if run.status == 'running':
                    run.status, run.finished_at = 'bounded', datetime.now(UTC)
                if collection.mode == 'reference' and run.status == 'succeeded':
                    await self.mark_missing_references(collection, {row['source_id'] for row in run.results})
            except CollectionCancelled:
                run.status, run.finished_at = 'cancelled', datetime.now(UTC)
            except ProviderError as exc:
                run.status = 'retry' if exc.retryable else 'failed'
                run.error_code = exc.code
                if collection.mode == 'reference' and exc.code in ('provider_forbidden', 'provider_not_found'):
                    await self.mark_inaccessible_references(collection)
                if not exc.retryable:
                    run.finished_at = datetime.now(UTC)
                raise
            except Exception:
                # Roll back failed database work before recording a sanitized retry.
                await self.repository.rollback()
                run = await self.repository.one(CloudCollectionRun, run_id)
                run.status, run.error_code = 'retry', 'collection_persistence_error'
                raise
            finally:
                # Request settlement already persists bytes. Do not refund a
                # reservation after persistence failure or add the count twice.
                http.account_bytes = None
                collection.last_refresh_status = run.status
                collection.last_refreshed_at = run.finished_at
                collection.last_error_code = run.error_code
                await self.repository.save(collection)
                await self.repository.save(run)
            return self.run_projection(run, results=True)
