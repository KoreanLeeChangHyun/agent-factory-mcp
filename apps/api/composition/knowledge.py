from __future__ import annotations

from typing import Any

from agent_factory_adapters.embeddings.knowledge.provider import ServerEmbeddingProvider
from agent_factory_adapters.object_storage.knowledge.storage import KnowledgeObjectStorage
from agent_factory_adapters.pgvector.knowledge.search import PgvectorSearchRepository
from agent_factory_adapters.postgres.knowledge.cloud import PostgresCloudKnowledgeRepository
from agent_factory_adapters.postgres.knowledge.delivery import PostgresUploadIntentRepository
from agent_factory_adapters.postgres.knowledge.repository import PostgresKnowledgeRepository
from agent_factory_core.knowledge.application import CloudService, KnowledgeService
from agent_factory_core.knowledge.cloud import CloudKnowledgeUseCases
from agent_factory_core.knowledge.delivery import DocumentDeliveryUseCases
from agent_factory_core.knowledge.package_queries import DocumentPackageQueries
from agent_factory_core.knowledge.packages import cloud_package_limits
from agent_factory_core.knowledge.use_cases import DocumentUseCases, SearchUseCases
from sqlalchemy.ext.asyncio import AsyncSession


def build_knowledge_service(
    session: AsyncSession,
    *,
    object_client: Any,
    embedding_client: Any,
    settings: Any,
    request_id: str | None = None,
    source: str = "http",
) -> KnowledgeService:
    repository = PostgresKnowledgeRepository(session, request_id=request_id, source=source)
    storage = KnowledgeObjectStorage(object_client)
    return KnowledgeService(
        documents=DocumentUseCases(
            repository,
            storage,
            max_upload_bytes=settings.document_max_upload_bytes,
        ),
        search=SearchUseCases(
            PgvectorSearchRepository(session, request_id=request_id, source=source),
            repository,
            storage,
            ServerEmbeddingProvider(embedding_client),
            provider_name=settings.embedding_provider,
            model=settings.embedding_model,
            chunk_size=settings.document_chunk_characters,
            chunk_overlap=settings.document_chunk_overlap,
        ),
    )


def build_document_knowledge_service(
    session: AsyncSession,
    *,
    object_client: Any,
    settings: Any,
    request_id: str | None = None,
    source: str = "http",
) -> DocumentUseCases:
    return DocumentUseCases(
        PostgresKnowledgeRepository(session, request_id=request_id, source=source),
        KnowledgeObjectStorage(object_client),
        max_upload_bytes=settings.document_max_upload_bytes,
    )


def build_cloud_knowledge_service(
    session: AsyncSession,
    *,
    object_client: Any,
    settings: Any,
    request_id: str | None = None,
    source: str = "http",
) -> CloudService:
    storage = KnowledgeObjectStorage(object_client)
    documents = PostgresKnowledgeRepository(session, request_id=request_id, source=source)
    limits = cloud_package_limits(
        upload_bytes=settings.document_max_upload_bytes,
        expanded_bytes=getattr(settings, "document_package_expanded_bytes", 64 * 1024 * 1024),
        member_bytes=getattr(settings, "document_package_member_bytes", 16 * 1024 * 1024),
        entries=getattr(settings, "document_package_entries", 2_048),
        ratio=getattr(settings, "document_package_ratio", 200),
    )
    cloud = CloudKnowledgeUseCases(
        PostgresCloudKnowledgeRepository(session, request_id=request_id, source=source),
        storage,
        limits,
    )
    return CloudService(
        cloud=cloud,
        delivery=DocumentDeliveryUseCases(
            PostgresUploadIntentRepository(session, request_id=request_id, source=source),
            storage,
            cloud,
            max_upload_bytes=limits.upload_bytes,
        ),
        packages=DocumentPackageQueries(documents, storage, limits),
    )
