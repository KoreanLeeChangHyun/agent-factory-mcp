from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any, NoReturn, Protocol
from urllib.parse import quote
from uuid import UUID

from agent_factory_core.knowledge.application import KnowledgeService
from agent_factory_core.knowledge.domain import (
    Document,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    EmbeddingProfile,
    KnowledgeActor,
    Provenance,
    ProvenanceRelation,
    SearchHit,
)
from agent_factory_core.knowledge.errors import (
    KnowledgeConflictError,
    KnowledgeError,
    KnowledgeNotFoundError,
    KnowledgePermissionError,
    KnowledgeProviderError,
    KnowledgeValidationError,
)
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Context(Protocol):
    principal: Any
    scope: Any
    permissions: frozenset[str]


class DocumentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    document_type: DocumentType
    metadata: dict[str, object] = Field(default_factory=dict)


class DocumentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    status: DocumentStatus
    metadata: dict[str, object] = Field(default_factory=dict)
    revision: int = Field(ge=1)


class ProvenanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_document_id: UUID
    target_document_id: UUID
    relation: ProvenanceRelation
    metadata: dict[str, object] = Field(default_factory=dict)

    @model_validator(mode="after")
    def no_cycle_to_self(self) -> ProvenanceRequest:
        if self.source_document_id == self.target_document_id:
            raise ValueError("a document cannot derive from itself")
        return self


class ProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=200)
    dimensions: int = Field(ge=1, le=2000)


class IndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision_number: int = Field(ge=1)


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=2000)
    embedding_profile_id: UUID
    limit: int = Field(default=10, ge=1, le=50)

    @field_validator("query")
    @classmethod
    def trim_query(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be blank")
        return value.strip()


def _actor(context: Context) -> KnowledgeActor:
    workspace_id = context.scope.workspace_id
    if workspace_id is None:
        raise HTTPException(400, detail={"code": "workspace_scope_required"})
    return KnowledgeActor(
        context.principal.user_id, context.scope.organization_id, workspace_id, context.permissions
    )


def _raise(error: KnowledgeError) -> NoReturn:
    status = 409
    if isinstance(error, KnowledgePermissionError):
        status = 403
    elif isinstance(error, KnowledgeNotFoundError):
        status = 404
    elif isinstance(error, KnowledgeValidationError):
        status = 422
    elif isinstance(error, KnowledgeProviderError):
        status = 503
    elif isinstance(error, KnowledgeConflictError):
        status = 409
    raise HTTPException(status, detail={"code": error.code, "message": str(error)}) from error


def _document(item: Document) -> dict[str, object]:
    return {
        "id": str(item.id),
        "workspace_id": str(item.workspace_id),
        "document_type": item.document_type.value,
        "title": item.title,
        "slug": item.slug,
        "status": item.status.value,
        "document_metadata": dict(item.metadata),
        "current_revision_number": item.current_revision_number,
        "revision": item.revision,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


def _revision(item: DocumentRevision) -> dict[str, object]:
    return {
        "id": str(item.id),
        "document_id": str(item.document_id),
        "revision_number": item.revision_number,
        "filename": item.filename,
        "media_type": item.media_type,
        "size_bytes": item.size_bytes,
        "sha256": item.sha256,
        "created_by_user_id": str(item.created_by_user_id),
        "revision_metadata": dict(item.metadata),
        "created_at": item.created_at.isoformat(),
    }


def _provenance(item: Provenance) -> dict[str, object]:
    return {
        "id": str(item.id),
        "source_document_id": str(item.source_document_id),
        "target_document_id": str(item.target_document_id),
        "relation": item.relation.value,
        "provenance_metadata": dict(item.metadata),
        "created_at": item.created_at.isoformat(),
    }


def _profile(item: EmbeddingProfile) -> dict[str, object]:
    return {
        "id": str(item.id),
        "workspace_id": str(item.workspace_id),
        "name": item.name,
        "provider": item.provider,
        "model": item.model,
        "dimensions": item.dimensions,
        "is_active": item.active,
    }


def _hit(item: SearchHit) -> dict[str, object]:
    return {
        "chunk_id": str(item.chunk_id),
        "document_id": str(item.document_id),
        "document_revision_id": str(item.document_revision_id),
        "content": item.content,
        "score": item.score,
        "semantic_score": item.semantic_score,
        "lexical_score": item.lexical_score,
        "metadata": dict(item.metadata),
    }


def create_knowledge_router(
    service_dependency: Callable[..., KnowledgeService],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
    *,
    max_upload_bytes: int,
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}", tags=["knowledge"]
    )
    service_dep, context_dep = Depends(service_dependency), Depends(context_dependency)

    @router.get("/documents")
    async def list_documents(
        document_type: Annotated[DocumentType | None, Query()] = None,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> list[dict[str, object]]:
        try:
            return [
                _document(item)
                for item in await service.documents.list(_actor(context), document_type)
            ]
        except KnowledgeError as error:
            _raise(error)

    @router.post("/documents", status_code=201, dependencies=[Depends(csrf_dependency)])
    async def create_document(
        payload: DocumentCreateRequest,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> dict[str, object]:
        try:
            return _document(
                await service.documents.create(
                    _actor(context),
                    title=payload.title,
                    slug=payload.slug,
                    document_type=payload.document_type,
                    metadata=payload.metadata,
                )
            )
        except KnowledgeError as error:
            _raise(error)

    @router.post("/documents/provenance", status_code=201, dependencies=[Depends(csrf_dependency)])
    async def add_provenance(
        payload: ProvenanceRequest,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> dict[str, object]:
        try:
            return _provenance(
                await service.documents.add_provenance(
                    _actor(context),
                    source_document_id=payload.source_document_id,
                    target_document_id=payload.target_document_id,
                    relation=payload.relation,
                    metadata=payload.metadata,
                )
            )
        except KnowledgeError as error:
            _raise(error)

    @router.get("/documents/{document_id}")
    async def get_document(
        document_id: UUID, context: Context = context_dep, service: KnowledgeService = service_dep
    ) -> dict[str, object]:
        try:
            return _document(await service.documents.get(_actor(context), document_id))
        except KnowledgeError as error:
            _raise(error)

    @router.put("/documents/{document_id}", dependencies=[Depends(csrf_dependency)])
    async def update_document(
        document_id: UUID,
        payload: DocumentUpdateRequest,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> dict[str, object]:
        try:
            return _document(
                await service.documents.update(
                    _actor(context),
                    document_id,
                    title=payload.title,
                    status=payload.status,
                    metadata=payload.metadata,
                    expected_revision=payload.revision,
                )
            )
        except KnowledgeError as error:
            _raise(error)

    @router.delete(
        "/documents/{document_id}", status_code=204, dependencies=[Depends(csrf_dependency)]
    )
    async def delete_document(
        document_id: UUID, context: Context = context_dep, service: KnowledgeService = service_dep
    ) -> Response:
        try:
            await service.documents.delete(_actor(context), document_id)
            return Response(status_code=204)
        except KnowledgeError as error:
            _raise(error)

    @router.post(
        "/documents/{document_id}/revisions",
        status_code=201,
        dependencies=[Depends(csrf_dependency)],
    )
    async def upload_revision(
        document_id: UUID,
        file: Annotated[UploadFile, File()],
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> dict[str, object]:
        content = await file.read(max_upload_bytes + 1)
        try:
            return _revision(
                await service.documents.add_revision(
                    _actor(context),
                    document_id,
                    filename=file.filename or "document",
                    media_type=file.content_type or "application/octet-stream",
                    content=content,
                )
            )
        except KnowledgeError as error:
            _raise(error)

    @router.get("/documents/{document_id}/revisions")
    async def list_revisions(
        document_id: UUID, context: Context = context_dep, service: KnowledgeService = service_dep
    ) -> list[dict[str, object]]:
        try:
            return [
                _revision(item)
                for item in await service.documents.revisions(_actor(context), document_id)
            ]
        except KnowledgeError as error:
            _raise(error)

    @router.get("/documents/{document_id}/revisions/{revision_number}/content")
    async def download_revision(
        document_id: UUID,
        revision_number: int,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> Response:
        try:
            revision, content = await service.documents.download(
                _actor(context), document_id, revision_number
            )
        except KnowledgeError as error:
            _raise(error)
        return Response(
            content,
            media_type=revision.media_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{quote(revision.filename)}",
                "Cache-Control": "no-store",
            },
        )

    @router.get("/documents/{document_id}/provenance")
    async def list_provenance(
        document_id: UUID, context: Context = context_dep, service: KnowledgeService = service_dep
    ) -> list[dict[str, object]]:
        try:
            return [
                _provenance(item)
                for item in await service.documents.provenance(_actor(context), document_id)
            ]
        except KnowledgeError as error:
            _raise(error)

    @router.get("/search/profiles")
    async def list_profiles(
        context: Context = context_dep, service: KnowledgeService = service_dep
    ) -> list[dict[str, object]]:
        try:
            return [_profile(item) for item in await service.search.profiles(_actor(context))]
        except KnowledgeError as error:
            _raise(error)

    @router.post("/search/profiles", status_code=201, dependencies=[Depends(csrf_dependency)])
    async def create_profile(
        payload: ProfileRequest,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> dict[str, object]:
        try:
            return _profile(
                await service.search.create_profile(
                    _actor(context),
                    name=payload.name,
                    provider=payload.provider,
                    model=payload.model,
                    dimensions=payload.dimensions,
                )
            )
        except KnowledgeError as error:
            _raise(error)

    @router.post(
        "/search/profiles/{profile_id}/documents/{document_id}/index",
        dependencies=[Depends(csrf_dependency)],
    )
    async def index_document(
        profile_id: UUID,
        document_id: UUID,
        payload: IndexRequest,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> dict[str, int]:
        try:
            return {
                "chunks_indexed": await service.search.index(
                    _actor(context),
                    document_id=document_id,
                    revision_number=payload.revision_number,
                    profile_id=profile_id,
                )
            }
        except (UnicodeDecodeError, KnowledgeError) as error:
            if isinstance(error, UnicodeDecodeError):
                _raise(
                    KnowledgeValidationError(
                        "invalid_document_encoding", "Searchable content must be UTF-8"
                    )
                )
            _raise(error)

    @router.post("/search")
    async def search(
        payload: SearchRequest,
        context: Context = context_dep,
        service: KnowledgeService = service_dep,
    ) -> list[dict[str, object]]:
        try:
            return [
                _hit(item)
                for item in await service.search.search(
                    _actor(context),
                    profile_id=payload.embedding_profile_id,
                    query=payload.query,
                    limit=payload.limit,
                )
            ]
        except KnowledgeError as error:
            _raise(error)

    return router
