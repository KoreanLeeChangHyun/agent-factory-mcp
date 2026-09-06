"""Authenticated HTTP import/search alongside the existing ordinary editor API."""
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.object_storage import S3ObjectStorage
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.document.cloud_schemas import ImportRequest, SearchRequest, IndexRequest
from app.modules.document.cloud_service import CloudDocumentService

router = APIRouter(prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/cloud-documents", tags=["documents"])

def service(session: Annotated[AsyncSession, Depends(get_session)]):
    return CloudDocumentService(session, S3ObjectStorage(settings), settings)

@router.post("/imports", dependencies=[Depends(require_csrf)])
async def import_document(request: ImportRequest,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.import"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return await documents.import_document(context, request)

@router.post("/search")
async def search(request: SearchRequest,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return {"hits": await documents.search(context, request.query, request.limit)}

@router.post("/index", dependencies=[Depends(require_csrf)])
async def index(request: IndexRequest,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.update"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return await documents.index_revision(context, request.document_id, request.revision_number)

# The binary route accepts the same API token verifier as MCP, or the existing
# browser session plus CSRF. The extra capability binds bytes to one intent.
from uuid import UUID
from fastapi import Header, Request, Response
from app.common.errors import PermissionDeniedError
from app.mcp.auth import ApiTokenVerifier
from app.modules.auth.authorization import AuthorizationRepository, AuthorizationScope, AuthorizationService
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.service import AuthService, Principal
from app.modules.organization.permissions import token_permissions
from app.modules.document.cloud_schemas import PrepareUpload, FinalizeUpload
from app.modules.document.delivery_service import DocumentDelivery

async def upload_context(request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    auth: Annotated[AuthService, Depends(get_auth_service)]):
    organization = UUID(request.path_params["organization_id"])
    workspace = UUID(request.path_params["workspace_id"])
    bearer = request.headers.get("authorization", "")
    if bearer:
        token = await ApiTokenVerifier(settings).verify_token(bearer[7:]) if bearer.startswith("Bearer ") else None
        if token is None or "document.import" not in token_permissions(token.scopes) or not token.subject:
            raise PermissionDeniedError("document_token_required", "Document write token required")
        claims = token.claims or {}
        if claims.get("workspace_id") and (claims["workspace_id"] != str(workspace) or claims.get("organization_id") != str(organization)):
            raise PermissionDeniedError("workspace_token_mismatch", "Token belongs to another Workspace")
        principal = Principal(UUID(token.subject), claims["email"], claims["display_name"], claims["is_platform_admin"])
    else:
        require_csrf(request.headers.get("X-CSRF-Token"), request.cookies.get("agent_factory_csrf"))
        principal = await auth.authenticate_session(request.cookies.get(settings.session_cookie_name))
    return await AuthorizationService(AuthorizationRepository(session)).authorize(
        principal, AuthorizationScope(organization, workspace), "document.import")

@router.post("/uploads/prepare", dependencies=[Depends(require_csrf)])
async def prepare_upload(request: PrepareUpload,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.import"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return await DocumentDelivery(documents).prepare(context, request)

@router.put("/uploads/{upload_id}/content")
async def upload_content(upload_id: UUID, request: Request,
    capability: Annotated[str, Header(alias="X-Document-Upload-Capability", min_length=40, max_length=100)],
    context: Annotated[AuthorizedContext, Depends(upload_context)],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return await DocumentDelivery(documents).upload(context, upload_id, capability, request.stream())

@router.post("/uploads/finalize", dependencies=[Depends(require_csrf)])
async def finalize_upload(request: FinalizeUpload,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.import"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return await DocumentDelivery(documents).finalize(context, request.upload_id)

@router.get("/{document_id}/revisions/{revision_number}/package")
async def package_manifest(document_id: UUID, revision_number: int,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    return await DocumentDelivery(documents).manifest(context, document_id, revision_number)

@router.get("/{document_id}/revisions/{revision_number}/package/member")
async def package_member(document_id: UUID, revision_number: int, path: str,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.export"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    raw = await DocumentDelivery(documents).member(context, document_id, revision_number, path)
    # Member bytes are never executable at the authenticated application origin.
    return Response(raw, media_type="application/octet-stream", headers={
        "Content-Disposition": "attachment", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

@router.get("/{document_id}/revisions/{revision_number}/package/preview")
async def package_preview(document_id: UUID, revision_number: int,
    context: Annotated[AuthorizedContext, Depends(require_permission("document.read"))],
    documents: Annotated[CloudDocumentService, Depends(service)]):
    from app.modules.document.preview import render_preview, PREVIEW_HEADERS
    revision, files = await DocumentDelivery(documents).package(context, document_id, revision_number)
    pair = revision.revision_metadata.get("specification_pair")
    entry = pair["human_root"] + "/index.html" if pair else "index.html"
    return Response(render_preview(files, entry), media_type="text/html", headers=PREVIEW_HEADERS)
