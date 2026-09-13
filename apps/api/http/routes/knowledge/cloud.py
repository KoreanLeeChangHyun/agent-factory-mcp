from __future__ import annotations

import base64
import binascii
from collections.abc import Callable
from typing import Annotated, Any, Literal, NoReturn, Protocol
from uuid import UUID

from agent_factory_core.knowledge.application import CloudService
from agent_factory_core.knowledge.cloud import CloudImportCommand
from agent_factory_core.knowledge.domain import DocumentType, KnowledgeActor
from agent_factory_core.knowledge.errors import (
    KnowledgeConflictError,
    KnowledgeError,
    KnowledgeNotFoundError,
    KnowledgePermissionError,
    KnowledgeValidationError,
)
from agent_factory_core.knowledge.packages import (
    package_manifest,
)
from agent_factory_core.knowledge.specification_pair import PairReview, SpecificationPair
from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from .preview import PREVIEW_HEADERS, render_preview

PACKAGE_PREVIEW_ENDPOINTS: set[Callable[..., object]] = set()


class Context(Protocol):
    principal: Any
    scope: Any
    permissions: frozenset[str]


class Closed(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReviewRequest(Closed):
    reviewer: str = Field(min_length=1, max_length=200)
    evidence: str = Field(min_length=20, max_length=16_000)
    authority_reference: str = Field(min_length=1, max_length=2_000)
    ai_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    human_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    verdict: Literal["aligned"]


class PairRequest(Closed):
    specification_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=64)
    ai_root: str = Field(min_length=1, max_length=512)
    human_root: str = Field(min_length=1, max_length=512)
    git_repository: str = Field(min_length=1, max_length=2_000)
    git_commit: str = Field(pattern=r"^(?:[a-f0-9]{40}|[a-f0-9]{64})$")
    review: ReviewRequest


class ImportMetadataRequest(Closed):
    schema_version: Literal["1"]
    idempotency_key: str = Field(min_length=1, max_length=160)
    document_id: UUID | None = None
    expected_revision: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    document_type: DocumentType
    filename: str = Field(min_length=1, max_length=255)
    media_type: Literal[
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
        "application/zip",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    ]
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_identity: str = Field(min_length=1, max_length=2_000)
    collection_context: str = Field(min_length=1, max_length=8_000)
    pair: PairRequest | None = None


class ImportRequest(ImportMetadataRequest):
    content_base64: str = Field(min_length=1, max_length=4 * ((256 * 1024 + 2) // 3))


class PrepareRequest(ImportMetadataRequest):
    size_bytes: int = Field(ge=1, le=128 * 1024 * 1024)


class FinalizeRequest(Closed):
    schema_version: Literal["1"]
    upload_id: UUID


class LexicalSearchRequest(Closed):
    schema_version: Literal["1"]
    query: str = Field(min_length=1, max_length=300)
    limit: int = Field(default=20, ge=1, le=100)


class LexicalIndexRequest(Closed):
    schema_version: Literal["1"]
    document_id: UUID
    revision_number: int = Field(ge=1)


def _actor(context: Context) -> KnowledgeActor:
    if context.scope.workspace_id is None:
        raise KnowledgeValidationError("workspace_scope_required", "Workspace is required")
    return KnowledgeActor(
        context.principal.user_id,
        context.scope.organization_id,
        context.scope.workspace_id,
        context.permissions,
    )


def _command(request: ImportMetadataRequest) -> CloudImportCommand:
    pair = None
    if request.pair:
        review = request.pair.review
        pair = SpecificationPair(
            request.pair.specification_id,
            request.pair.ai_root,
            request.pair.human_root,
            request.pair.git_repository,
            request.pair.git_commit,
            PairReview(
                review.reviewer,
                review.evidence,
                review.authority_reference,
                review.ai_sha256,
                review.human_sha256,
                review.verdict,
            ),
        )
    return CloudImportCommand(
        request.idempotency_key,
        request.document_id,
        request.expected_revision,
        request.title,
        request.slug,
        request.document_type,
        request.filename,
        request.media_type,
        request.source_sha256,
        request.source_identity,
        request.collection_context,
        pair,
    )


def _error(error: KnowledgeError) -> NoReturn:
    from fastapi import HTTPException

    status = 409
    if isinstance(error, KnowledgePermissionError):
        status = 403
    elif isinstance(error, KnowledgeNotFoundError):
        status = 404
    elif isinstance(error, KnowledgeValidationError):
        status = 400 if error.code == "upload_integrity_mismatch" else 422
    elif isinstance(error, KnowledgeConflictError):
        status = 409
    raise HTTPException(status, detail={"code": error.code, "message": str(error)}) from error


def create_cloud_knowledge_router(
    service_dependency: Callable[..., CloudService],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/cloud-documents",
        tags=["knowledge"],
    )
    service_dep, context_dep = Depends(service_dependency), Depends(context_dependency)

    @router.post("/imports", dependencies=[Depends(csrf_dependency)])
    async def import_document(
        payload: ImportRequest, context: Context = context_dep, service: CloudService = service_dep
    ) -> dict[str, object]:
        try:
            content = base64.b64decode(payload.content_base64, validate=True)
        except (ValueError, binascii.Error) as error:
            from fastapi import HTTPException

            raise HTTPException(422, detail={"code": "invalid_base64"}) from error
        try:
            receipt = await service.cloud.import_bytes(_actor(context), _command(payload), content)
            return {
                "document_id": str(receipt.document_id),
                "revision_id": str(receipt.revision_id),
                "revision_number": receipt.revision_number,
                "request_sha256": receipt.request_sha256,
            }
        except KnowledgeError as error:
            _error(error)

    @router.post("/search")
    async def lexical_search(
        payload: LexicalSearchRequest,
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> dict[str, object]:
        try:
            hits = await service.cloud.search(_actor(context), payload.query, payload.limit)
            return {
                "hits": [
                    {
                        "document_id": str(hit.document_id),
                        "revision_id": str(hit.revision_id),
                        "source_path": hit.source_path,
                        "content": hit.content,
                    }
                    for hit in hits
                ]
            }
        except KnowledgeError as error:
            _error(error)

    @router.post("/index", dependencies=[Depends(csrf_dependency)])
    async def lexical_index(
        payload: LexicalIndexRequest,
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> dict[str, int]:
        try:
            return {
                "chunks_indexed": await service.cloud.index(
                    _actor(context),
                    document_id=payload.document_id,
                    revision_number=payload.revision_number,
                )
            }
        except KnowledgeError as error:
            _error(error)

    @router.post("/uploads/prepare", dependencies=[Depends(csrf_dependency)])
    async def prepare_upload(
        payload: PrepareRequest, context: Context = context_dep, service: CloudService = service_dep
    ) -> dict[str, object]:
        try:
            intent, capability = await service.delivery.prepare(
                _actor(context), _command(payload), payload.size_bytes
            )
            return {
                "upload_id": str(intent.id),
                "expires_at": intent.expires_at.isoformat(),
                "method": "PUT",
                "header": "X-Document-Upload-Capability",
                "capability": capability,
                "size_bytes": intent.size_bytes,
                "source_sha256": intent.command.source_sha256,
                "uploaded": intent.uploaded,
                "finalized": intent.finalized,
                "path": f"/api/organizations/{context.scope.organization_id}/workspaces/{context.scope.workspace_id}/cloud-documents/uploads/{intent.id}/content",
            }
        except KnowledgeError as error:
            _error(error)

    @router.put(
        "/uploads/{upload_id}/content",
        dependencies=[Depends(csrf_dependency)],
    )
    async def upload_content(
        upload_id: UUID,
        request: Request,
        capability: Annotated[
            str, Header(alias="X-Document-Upload-Capability", min_length=40, max_length=100)
        ],
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> dict[str, object]:
        try:
            await service.delivery.upload(_actor(context), upload_id, capability, request.stream())
            return {"upload_id": str(upload_id), "uploaded": True}
        except KnowledgeError as error:
            _error(error)

    @router.post("/uploads/finalize", dependencies=[Depends(csrf_dependency)])
    async def finalize_upload(
        payload: FinalizeRequest,
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> dict[str, object]:
        try:
            receipt = await service.delivery.finalize(_actor(context), payload.upload_id)
            return {
                "document_id": str(receipt.document_id),
                "revision_id": str(receipt.revision_id),
                "revision_number": receipt.revision_number,
                "request_sha256": receipt.request_sha256,
            }
        except KnowledgeError as error:
            _error(error)

    @router.get("/{document_id}/revisions/{revision_number}/package")
    async def package_index(
        document_id: UUID,
        revision_number: int,
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> dict[str, object]:
        try:
            revision, files = await service.packages.read(
                _actor(context), document_id, revision_number
            )
            pair = revision.metadata.get("specification_pair")
            human_root = pair.get("human_root") if isinstance(pair, dict) else None
            entry = (
                f"{human_root}/index.html"
                if human_root
                else ("index.html" if "index.html" in files else None)
            )
            return {
                "revision_id": str(revision.id),
                "revision_number": revision.revision_number,
                "source_sha256": revision.sha256,
                "human_entry": entry,
                "members": [
                    {"path": member.path, "size_bytes": member.size_bytes, "sha256": member.sha256}
                    for member in package_manifest(files)
                ],
            }
        except KnowledgeError as error:
            _error(error)

    @router.get("/{document_id}/revisions/{revision_number}/package/member")
    async def package_member(
        document_id: UUID,
        revision_number: int,
        path: str,
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> Response:
        try:
            content = await service.packages.member(
                _actor(context), document_id, revision_number, path
            )
            return Response(
                content,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": "attachment",
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except KnowledgeError as error:
            _error(error)

    @router.get("/{document_id}/revisions/{revision_number}/package/preview")
    async def package_preview(
        document_id: UUID,
        revision_number: int,
        context: Context = context_dep,
        service: CloudService = service_dep,
    ) -> Response:
        try:
            revision, files = await service.packages.read(
                _actor(context), document_id, revision_number
            )
            pair = revision.metadata.get("specification_pair")
            human_root = pair.get("human_root") if isinstance(pair, dict) else None
            entry = f"{human_root}/index.html" if human_root else "index.html"
            return Response(
                render_preview(files, entry),
                media_type="text/html",
                headers=PREVIEW_HEADERS,
            )
        except KnowledgeError as error:
            _error(error)

    PACKAGE_PREVIEW_ENDPOINTS.add(package_preview)
    return router
