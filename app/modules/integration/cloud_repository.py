"""Tenant-filtered persistence and connection serialization across document commits."""

from contextlib import asynccontextmanager
from hashlib import sha256

from sqlalchemy import event, select, text

from app.common.errors import ConflictError, NotFoundError
from app.db.tenant import TenantContext, apply_tenant_context
from app.modules.document.models import Document
from app.modules.integration.cloud_models import CloudCollection, CloudCollectionRun, CloudConnectionState, CloudSourceMapping
from app.modules.integration.repository import IntegrationRepository


class CloudRepository(IntegrationRepository):
    def __init__(self, session, context):
        super().__init__(session)
        self.context = context
        self.workspace_id = context.scope.workspace_id
        if self.workspace_id is None:
            raise ValueError('workspace context required')
        tenant = {'app.current_user_id': str(context.principal.user_id),
                  'app.current_organization_id': str(context.scope.organization_id),
                  'app.current_workspace_id': str(self.workspace_id),
                  'app.is_platform_admin': 'true' if context.principal.is_platform_admin else 'false'}
        existing = session.info.get('cloud_integration_tenant')
        if existing is not None and existing != tenant:
            raise ValueError('session cannot change cloud tenant')
        if existing is None:
            session.info['cloud_integration_tenant'] = tenant
            def establish(sync_session, transaction, connection):
                for key, value in tenant.items():
                    connection.execute(text('SELECT set_config(:key, :value, true)'), {'key': key, 'value': value})
            event.listen(session.sync_session, 'after_begin', establish)

    async def scope(self):
        await apply_tenant_context(self.session, TenantContext(
            self.context.principal.user_id, self.context.scope.organization_id,
            self.workspace_id, self.context.principal.is_platform_admin))

    async def one(self, model, identifier):
        await self.scope()
        record = await self.session.scalar(select(model).where(
            model.id == identifier, model.workspace_id == self.workspace_id).execution_options(populate_existing=True))
        if record is None:
            raise NotFoundError('integration_record_not_found', 'Integration record not found')
        return record

    async def connection(self, identifier):
        await self.scope()
        record = await self.get_connection(self.workspace_id, identifier)
        if record is None:
            raise NotFoundError('integration_connection_not_found', 'Integration connection not found')
        return record

    async def state(self, identifier):
        await self.scope()
        record = await self.session.scalar(select(CloudConnectionState).where(
            CloudConnectionState.workspace_id == self.workspace_id,
            CloudConnectionState.connection_id == identifier))
        if record is None:
            record = CloudConnectionState(workspace_id=self.workspace_id, connection_id=identifier,
                                          requested_scopes=[], granted_scopes=None, inspection={})
            self.session.add(record)
            await self.session.flush()
        return record

    async def find_run(self, collection_id, key):
        await self.scope()
        return await self.session.scalar(select(CloudCollectionRun).where(
            CloudCollectionRun.workspace_id == self.workspace_id,
            CloudCollectionRun.collection_id == collection_id, CloudCollectionRun.request_key == key))

    async def mapping(self, collection_id, source_id):
        await self.scope()
        return await self.session.scalar(select(CloudSourceMapping).where(
            CloudSourceMapping.workspace_id == self.workspace_id,
            CloudSourceMapping.collection_id == collection_id, CloudSourceMapping.source_id == source_id))

    async def document_by_slug(self, slug):
        await self.scope()
        return await self.session.scalar(select(Document).where(
            Document.workspace_id == self.workspace_id, Document.slug == slug))

    async def cancelled(self, run_id):
        await self.scope()
        return bool(await self.session.scalar(select(CloudCollectionRun.cancel_requested).where(
            CloudCollectionRun.workspace_id == self.workspace_id, CloudCollectionRun.id == run_id)))

    async def save(self, record):
        await self.scope()
        self.session.add(record)
        await self.session.commit()

    @asynccontextmanager
    async def guard(self, connection_id):
        # A dedicated transaction holds the lock while DocumentService commits
        # independently. It is automatically released on process/connection loss.
        key = int.from_bytes(sha256(f'{self.workspace_id}:{connection_id}'.encode()).digest()[:8], 'big', signed=True)
        async with self.session.bind.connect() as lock_connection:
            async with lock_connection.begin():
                acquired = await lock_connection.scalar(text('SELECT pg_try_advisory_xact_lock(:key)'), {'key': key})
                if not acquired:
                    raise ConflictError('integration_busy', 'Connection has an operation in progress')
                yield
