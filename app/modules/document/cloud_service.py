"""Authenticated imports publish content, receipt and lexical projection atomically."""

import json
from uuid import uuid4
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError
from app.common.errors import ApplicationError, ConflictError, NotFoundError, PermissionDeniedError
from app.modules.auth.authorization import require_workspace_id
from app.modules.document.cloud_models import DocumentImport, DocumentText
from app.modules.document.models import Document, DocumentRevision, DocumentType
from app.modules.document.package import decode_content, digest, extract, unpack
from app.modules.document.pair import validate_pair
from app.modules.document.delivery_limits import PackageLimits
from app.modules.document.repository import DocumentRepository


def require(context, write=False, permission=None):
    workspace = require_workspace_id(context)
    permission = permission or ("document.import" if write else "document.read")
    if permission not in context.permissions:
        raise PermissionDeniedError("permission_required", "Document permission required")
    return workspace


def receipt_result(record):
    return {
        "document_id": str(record.document_id),
        "revision_id": str(record.revision_id),
        "revision_number": record.revision_number,
        "request_sha256": record.request_sha256,
    }


class CloudDocumentService:
    def __init__(self, session, storage, settings):
        self.session = session
        self.storage = storage
        self.settings = settings
        self.repository = DocumentRepository(session)

    async def import_document(self, context, request):
        workspace = require(context, True)
        return await self.import_bytes(context, request, decode_content(request))

    async def import_bytes(self, context, request, raw):
        workspace = require(context, True)
        limits = PackageLimits.from_settings(self.settings)
        if not raw or len(raw) > limits.upload_bytes:
            raise ApplicationError("document_too_large", "Document exceeds upload limit", 413)
        if digest(raw) != request.source_sha256:
            raise ApplicationError("source_hash_mismatch", "Source digest mismatch", 400)
        files = unpack(raw, request.media_type, request.filename, limits)
        pair = None
        if request.document_type == DocumentType.SPECIFICATION:
            if request.pair is None or request.media_type != "application/zip":
                raise ApplicationError(
                    "pair_required", "Specification requires a complete reviewed package", 400
                )
            pair = validate_pair(files, request.pair, request.slug)
        elif request.pair is not None:
            raise ApplicationError(
                "pair_type_mismatch", "Pair is only valid for Specifications", 400
            )
        chunks = (
            extract(files, request.media_type)
            if request.media_type
            in {"application/zip", "application/json", "text/plain", "text/markdown", "text/csv"}
            else []
        )
        fingerprint = digest(
            json.dumps(
                request.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
            ).encode()
        )
        try:
            # Transaction-scoped lock serializes retries, including concurrent first imports.
            lock = int.from_bytes(
                bytes.fromhex(digest(f"{workspace}:{request.idempotency_key}".encode()))[:8],
                "big",
                signed=True,
            )
            await self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
            previous = await self.session.scalar(
                select(DocumentImport).where(
                    DocumentImport.workspace_id == workspace,
                    DocumentImport.idempotency_key == request.idempotency_key,
                )
            )
            if previous:
                if previous.request_sha256 != fingerprint:
                    raise ConflictError(
                        "import_payload_conflict", "Idempotency key has different content"
                    )
                if await self.repository.get(workspace, previous.document_id) is None:
                    raise ConflictError(
                        "import_target_deleted", "Previously imported document is unavailable"
                    )
                return receipt_result(previous)
            if request.document_id:
                document = await self.session.scalar(
                    select(Document)
                    .where(
                        Document.workspace_id == workspace,
                        Document.id == request.document_id,
                        Document.deleted_at.is_(None),
                    )
                    .with_for_update()
                )
                if document is None:
                    raise NotFoundError("document_not_found", "Document not found")
                if document.document_type != request.document_type or document.slug != request.slug:
                    raise ConflictError(
                        "document_identity_conflict", "Document identity and type must be preserved"
                    )
                if document.current_revision_number != request.expected_revision:
                    raise ConflictError(
                        "document_revision_conflict", "Document changed concurrently"
                    )
            else:
                if request.expected_revision != 0:
                    raise ConflictError(
                        "document_revision_conflict", "New documents require revision zero"
                    )
                document = await self.repository.create(
                    workspace, request.title, request.slug, request.document_type, {}
                )
            number = document.current_revision_number + 1
            revision_id = uuid4()
            key = f"workspaces/{workspace}/documents/{document.id}/revisions/{number}/{revision_id.hex}"
            metadata = {
                "cloud_schema_version": "1",
                "source_identity": request.source_identity,
                "source_sha256": request.source_sha256,
                "collection_context": request.collection_context,
                "files": {name: digest(data) for name, data in sorted(files.items())},
            }
            if pair:
                metadata["specification_pair"] = pair
            revision = DocumentRevision(
                id=revision_id,
                workspace_id=workspace,
                document_id=document.id,
                revision_number=number,
                storage_key=key,
                filename=request.filename,
                media_type=request.media_type,
                size_bytes=len(raw),
                sha256=digest(raw),
                created_by_user_id=context.principal.user_id,
                revision_metadata=metadata,
            )
            # A unique immutable object holds both representations. No partial pair is exposed.
            await self.storage.put(key, raw, request.media_type)
            if digest(await self.storage.get(key)) != revision.sha256:
                raise ApplicationError(
                    "storage_hash_mismatch", "Staged document integrity failed", 503
                )
            await self.repository.add_revision(revision)
            document.title = request.title
            if pair:
                document.document_metadata = {
                    **document.document_metadata,
                    "cloud_pair_revision": number,
                }
            for index, (path, content) in enumerate(chunks):
                self.session.add(
                    DocumentText(
                        workspace_id=workspace,
                        document_id=document.id,
                        revision_id=revision_id,
                        chunk_index=index,
                        source_path=path,
                        content=content,
                    )
                )
            receipt = DocumentImport(
                workspace_id=workspace,
                document_id=document.id,
                revision_id=revision_id,
                revision_number=number,
                idempotency_key=request.idempotency_key,
                request_sha256=fingerprint,
            )
            self.session.add(receipt)
            await self.session.commit()
            return receipt_result(receipt)
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(
                "document_import_conflict", "Document import conflicts with current state"
            ) from exc
        except Exception:
            await self.session.rollback()
            # Leave uniquely keyed staging objects for operator retention/recovery. A commit
            # acknowledgement can fail after commit; deleting would corrupt a valid revision.
            raise

    async def index_revision(self, context, document_id, revision_number):
        workspace = require(context, permission="document.update")
        document = await self.repository.get(workspace, document_id)
        if document is None:
            raise NotFoundError("document_not_found", "Document not found")
        revision = await self.session.scalar(
            select(DocumentRevision)
            .where(
                DocumentRevision.workspace_id == workspace,
                DocumentRevision.document_id == document_id,
                DocumentRevision.revision_number == revision_number,
            )
            .with_for_update()
        )
        if revision is None:
            raise NotFoundError("document_revision_not_found", "Document revision not found")
        if revision.size_bytes > PackageLimits.from_settings(self.settings).upload_bytes:
            raise ApplicationError("document_too_large", "Document exceeds indexing limit", 413)
        if revision.media_type not in {
            "application/zip",
            "application/json",
            "text/plain",
            "text/markdown",
            "text/csv",
        }:
            raise ApplicationError(
                "document_extraction_required", "Unsupported text extraction format", 415
            )
        raw = await self.storage.get(revision.storage_key)
        if digest(raw) != revision.sha256:
            raise ApplicationError("source_hash_mismatch", "Stored revision integrity failed", 409)
        chunks = extract(
            unpack(
                raw,
                revision.media_type,
                revision.filename,
                PackageLimits.from_settings(self.settings),
            ),
            revision.media_type,
        )
        await self.session.execute(
            delete(DocumentText).where(
                DocumentText.workspace_id == workspace, DocumentText.revision_id == revision.id
            )
        )
        for index, (path, content) in enumerate(chunks):
            self.session.add(
                DocumentText(
                    workspace_id=workspace,
                    document_id=document_id,
                    revision_id=revision.id,
                    chunk_index=index,
                    source_path=path,
                    content=content,
                )
            )
        await self.session.commit()
        return {"chunks": len(chunks)}

    async def search(self, context, query, limit=20):
        workspace = require(context)
        terms = query.strip().split()
        if not terms or len(query) > 300 or len(terms) > 16 or not 1 <= limit <= 100:
            raise ApplicationError(
                "invalid_search", "Search requires a bounded query and limit", 400
            )
        statement = (
            select(DocumentText)
            .join(Document, Document.id == DocumentText.document_id)
            .join(DocumentRevision, DocumentRevision.id == DocumentText.revision_id)
            .where(
                DocumentText.workspace_id == workspace,
                Document.workspace_id == workspace,
                DocumentRevision.workspace_id == workspace,
                Document.deleted_at.is_(None),
                Document.current_revision_number == DocumentRevision.revision_number,
            )
        )
        for term in terms:
            statement = statement.where(DocumentText.content.icontains(term, autoescape=True))
        rows = await self.session.scalars(
            statement.order_by(
                Document.updated_at.desc(), DocumentText.document_id, DocumentText.chunk_index
            ).limit(limit)
        )
        return [
            {
                "document_id": str(row.document_id),
                "revision_id": str(row.revision_id),
                "source_path": row.source_path,
                "content": row.content,
            }
            for row in rows
        ]
