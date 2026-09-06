"""Request/worker-scoped cloud service composition; no startup network traffic."""

from contextlib import asynccontextmanager

import httpx

from app.core.config import settings
from app.infrastructure.job_queue import CeleryJobPublisher
from app.infrastructure.object_storage import S3ObjectStorage
from app.infrastructure.secret_encryption import SecretCipher
from app.modules.document.repository import DocumentRepository
from app.modules.document.service import DocumentService
from app.modules.integration.cloud_connections import CloudConnections
from app.modules.integration.cloud_http import ProviderHTTP
from app.modules.integration.cloud_oauth import environment_oauth
from app.modules.integration.cloud_repository import CloudRepository
from app.modules.integration.cloud_service import CloudCollectionService
from app.modules.schedule.repository import ScheduleRepository
from app.modules.schedule.service import ScheduleService


@asynccontextmanager
async def cloud_services(session, context):
    async with httpx.AsyncClient(trust_env=False, follow_redirects=False) as client:
        repository = CloudRepository(session, context)
        connections = CloudConnections(repository, SecretCipher(settings.integration_encryption_key.get_secret_value(),
                                                               settings.integration_encryption_key_version),
                                       settings, ProviderHTTP(client), environment_oauth(settings))
        # Storage client creation is lazy so read-only inspection needs no S3 access.
        class LazyStorage:
            storage = None
            def get_storage(self):
                if self.storage is None:
                    self.storage = S3ObjectStorage(settings)
                return self.storage
            async def put(self, *args):
                return await self.get_storage().put(*args)
            async def get(self, *args):
                return await self.get_storage().get(*args)
            async def delete(self, *args):
                return await self.get_storage().delete(*args)
        documents = DocumentService(DocumentRepository(session), LazyStorage(), settings)
        schedules = ScheduleService(ScheduleRepository(session), CeleryJobPublisher(), settings)
        yield CloudCollectionService(repository, connections, documents, schedules)
