"""Document embedding profile, indexing, and hybrid search API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.embeddings import build_embedding_provider
from app.infrastructure.object_storage import S3ObjectStorage
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.document.search_repository import SearchRepository
from app.modules.document.search_schemas import (
    EmbeddingProfileCreate,
    EmbeddingProfileResponse,
    IndexDocumentRequest,
    IndexDocumentResponse,
    SearchHit,
    SearchRequest,
)
from app.modules.document.search_service import DocumentSearchService

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/search",
    tags=["document-search"],
)


def get_search_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DocumentSearchService:
    return DocumentSearchService(
        SearchRepository(session),
        build_embedding_provider(settings),
        S3ObjectStorage(settings),
        settings,
    )


@router.get("/profiles", response_model=list[EmbeddingProfileResponse])
async def list_profiles(
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    service: Annotated[DocumentSearchService, Depends(get_search_service)],
) -> list[EmbeddingProfileResponse]:
    return [
        EmbeddingProfileResponse.model_validate(record, from_attributes=True)
        for record in await service.list_profiles(context)
    ]


@router.post(
    "/profiles",
    response_model=EmbeddingProfileResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_profile(
    payload: EmbeddingProfileCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.update"))],
    service: Annotated[DocumentSearchService, Depends(get_search_service)],
) -> EmbeddingProfileResponse:
    record = await service.create_profile(
        context, payload.name, payload.provider, payload.model, payload.dimensions
    )
    return EmbeddingProfileResponse.model_validate(record, from_attributes=True)


@router.post(
    "/profiles/{profile_id}/documents/{document_id}/index",
    response_model=IndexDocumentResponse,
    dependencies=[Depends(require_csrf)],
)
async def index_document(
    profile_id: UUID,
    document_id: UUID,
    payload: IndexDocumentRequest,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.update"))],
    service: Annotated[DocumentSearchService, Depends(get_search_service)],
) -> IndexDocumentResponse:
    count = await service.index_document(
        context, document_id, payload.document_revision_id, profile_id
    )
    return IndexDocumentResponse(chunks_indexed=count)


@router.post("", response_model=list[SearchHit])
async def hybrid_search(
    payload: SearchRequest,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    service: Annotated[DocumentSearchService, Depends(get_search_service)],
) -> list[SearchHit]:
    return await service.search(context, payload.embedding_profile_id, payload.query, payload.limit)
