"""Cloud Document MCP installation hook; all calls use the shared authorizer."""
import base64
import json
from typing import Annotated
from mcp_types import CallToolResult, TextContent
from app.common.errors import ApplicationError
from app.core.config import settings
from app.infrastructure.object_storage import S3ObjectStorage
from app.modules.document.cloud_schemas import ImportRequest, IndexRequest, ReadRequest, SearchRequest, WriteRequest
from app.modules.document.cloud_service import CloudDocumentService, require
from app.modules.document.cloud_schemas import PrepareUpload, FinalizeUpload
from app.modules.document.delivery_service import DocumentDelivery
from app.modules.document.template import TemplateRequest, read_template
from app.modules.document.models import DocumentType
from app.modules.document.repository import DocumentRepository
from app.modules.document.schemas import DocumentResponse, DocumentRevisionResponse, ProvenanceResponse
from app.modules.document.service import DocumentService


def result(payload, error=False):
    return CallToolResult(content=[TextContent(text=json.dumps(payload, ensure_ascii=False))],
                          structured_content=None if error else payload, is_error=error)

def dump(schema, record):
    return schema.model_validate(record, from_attributes=True).model_dump(mode="json")

def install_documents(server, authorize):
    async def invoke(organization_id, workspace_id, write, action, permission=None):
        try:
            session, context = await authorize(organization_id, workspace_id,
                "document:write" if write else "document:read",
                permission or ("document.import" if write else "document.read"))
            async with session:
                require(context, write, permission)
                storage = S3ObjectStorage(settings)
                cloud = CloudDocumentService(session, storage, settings)
                ordinary = DocumentService(DocumentRepository(session), storage, settings)
                return result(await action(context, ordinary, cloud))
        except ApplicationError as exc:
            return result({"code": exc.code, "message": exc.message}, True)
        except Exception:
            return result({"code": "document_operation_failed", "message": "Document operation failed"}, True)

    @server.tool(name="document_template", description="Read the packaged Specification authoring baseline: manifest then version-bound base64 member chunks up to 64 KiB; never an accepted pair")
    async def document_template(request: TemplateRequest, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            return read_template(request)
        return await invoke(organization_id, workspace_id, False, action)

    @server.tool(name="document_import", description="Import bounded v1 text or ZIP; Specifications require a reviewed complete pair")
    async def document_import(request: ImportRequest, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            return await cloud.import_document(context, request)
        return await invoke(organization_id, workspace_id, True, action)

    @server.tool(name="document_prepare_upload", description="Prepare a digest-bound binary HTTP upload; returns an expiring capability, never file bytes")
    async def document_prepare_upload(request: PrepareUpload, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            return await DocumentDelivery(cloud).prepare(context, request)
        return await invoke(organization_id, workspace_id, True, action)

    @server.tool(name="document_finalize_upload", description="Publish a previously uploaded complete Document through shared import validation")
    async def document_finalize_upload(request: FinalizeUpload, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            return await DocumentDelivery(cloud).finalize(context, request.upload_id)
        return await invoke(organization_id, workspace_id, True, action)

    @server.tool(name="document_read", description="Get metadata, revisions, provenance or bounded base64 content")
    async def document_read(request: ReadRequest, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            await ordinary.get(context, request.document_id)
            if request.operation == "get":
                return dump(DocumentResponse, await ordinary.get(context, request.document_id))
            if request.operation == "revisions":
                return {"revisions": [dump(DocumentRevisionResponse, row) for row in await ordinary.list_revisions(context, request.document_id)]}
            if request.operation == "provenance":
                return {"provenance": [dump(ProvenanceResponse, row) for row in await ordinary.list_provenance(context, request.document_id)]}
            revision = await ordinary.repository.get_revision(context.scope.workspace_id, request.document_id, request.revision_number)
            if revision is None:
                raise ApplicationError("document_revision_not_found", "Document revision not found", 404)
            if revision.size_bytes > 256 * 1024:
                raise ApplicationError("document_too_large", "Use HTTP download for larger revisions", 413)
            row, raw = await ordinary.download(context, request.document_id, request.revision_number)
            return {"revision": dump(DocumentRevisionResponse, row), "content_base64": base64.b64encode(raw).decode()}
        return await invoke(organization_id, workspace_id, False, action, "document.export" if request.operation == "download" else "document.read")

    @server.tool(name="document_write", description="Versioned Document metadata CRUD and loose provenance; content revisions use document_import")
    async def document_write(request: WriteRequest, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            if len(request.model_dump_json()) > 32000:
                raise ApplicationError("document_bounds", "Document command exceeds metadata limit", 413)
            if request.operation == "create":
                if request.document_type == DocumentType.SPECIFICATION:
                    raise ApplicationError("pair_required", "Create Specifications through document_import", 400)
                return dump(DocumentResponse, await ordinary.create(context, request.title, request.slug, request.document_type, request.metadata))
            if request.operation == "update":
                return dump(DocumentResponse, await ordinary.update(context, request.document_id, request.title, request.status, request.metadata, request.revision))
            if request.operation == "delete":
                await ordinary.delete(context, request.document_id)
                return {"deleted": True}
            return dump(ProvenanceResponse, await ordinary.add_provenance(context, request.source_document_id, request.target_document_id, request.relation, request.metadata))
        return await invoke(organization_id, workspace_id, True, action, {"create":"document.create", "delete":"document.delete"}.get(request.operation, "document.update"))

    @server.tool(name="document_search", description="Embedding-independent lexical substring search, including Korean and identifiers")
    async def document_search(request: SearchRequest, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            return {"hits": await cloud.search(context, request.query, request.limit)}
        return await invoke(organization_id, workspace_id, False, action)

    @server.tool(name="document_index", description="Build lexical projection for an existing bounded text or ZIP revision")
    async def document_index(request: IndexRequest, organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        async def action(context, ordinary, cloud):
            return await cloud.index_revision(context, request.document_id, request.revision_number)
        return await invoke(organization_id, workspace_id, True, action, "document.update")
