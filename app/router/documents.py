"""Workspace Document HTTP API."""

from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.object_storage import S3ObjectStorage
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.document.models import DocumentType
from app.modules.document.repository import DocumentRepository
from app.modules.document.schemas import (
    DocumentCreate,
    DocumentResponse,
    DocumentRevisionResponse,
    DocumentUpdate,
    ProvenanceCreate,
    ProvenanceResponse,
)
from app.modules.document.service import DocumentService

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/documents",
    tags=["documents"],
)


def get_document_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DocumentService:
    return DocumentService(DocumentRepository(session), S3ObjectStorage(settings), settings)


def _response(record: object) -> DocumentResponse:
    return DocumentResponse.model_validate(record, from_attributes=True)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
    document_type: Annotated[DocumentType | None, Query()] = None,
) -> list[DocumentResponse]:
    return [_response(record) for record in await service.list(context, document_type)]


@router.post(
    "", response_model=DocumentResponse, status_code=201, dependencies=[Depends(require_csrf)]
)
async def create_document(
    payload: DocumentCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.create"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    return _response(
        await service.create(
            context, payload.title, payload.slug, payload.document_type, payload.metadata
        )
    )


@router.post(
    "/provenance",
    response_model=ProvenanceResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_provenance(
    payload: ProvenanceCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.update"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> ProvenanceResponse:
    record = await service.add_provenance(
        context,
        payload.source_document_id,
        payload.target_document_id,
        payload.relation,
        payload.metadata,
    )
    return ProvenanceResponse.model_validate(record, from_attributes=True)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    return _response(await service.get(context, document_id))


@router.put(
    "/{document_id}",
    response_model=DocumentResponse,
    dependencies=[Depends(require_csrf)],
)
async def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.update"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    return _response(
        await service.update(
            context,
            document_id,
            payload.title,
            payload.status,
            payload.metadata,
            payload.revision,
        )
    )


@router.delete("/{document_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def delete_document(
    document_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.delete"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> None:
    await service.delete(context, document_id)


@router.post(
    "/{document_id}/revisions",
    response_model=DocumentRevisionResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def upload_revision(
    document_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.update"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
    file: Annotated[UploadFile, File()],
) -> DocumentRevisionResponse:
    content = await file.read(settings.document_max_upload_bytes + 1)
    record = await service.add_revision(
        context,
        document_id,
        file.filename or "document",
        file.content_type or "application/octet-stream",
        content,
    )
    return DocumentRevisionResponse.model_validate(record, from_attributes=True)


@router.get("/{document_id}/revisions", response_model=list[DocumentRevisionResponse])
async def list_revisions(
    document_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> list[DocumentRevisionResponse]:
    return [
        DocumentRevisionResponse.model_validate(record, from_attributes=True)
        for record in await service.list_revisions(context, document_id)
    ]


@router.get("/{document_id}/revisions/{revision_number}/content")
async def download_revision(
    document_id: UUID,
    revision_number: int,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.export"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> Response:
    record, content = await service.download(context, document_id, revision_number)
    return Response(
        content,
        media_type=record.media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(record.filename)}"},
    )


@router.get("/{document_id}/provenance", response_model=list[ProvenanceResponse])
async def list_provenance(
    document_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> list[ProvenanceResponse]:
    return [
        ProvenanceResponse.model_validate(record, from_attributes=True)
        for record in await service.list_provenance(context, document_id)
    ]
