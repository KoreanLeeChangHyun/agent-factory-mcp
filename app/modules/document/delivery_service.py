"""Authenticated binary delivery and revision-scoped package reading."""
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from sqlalchemy import select, text
from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.modules.document.cloud_service import require
from app.modules.document.cloud_schemas import PrepareUpload
from app.modules.document.delivery_limits import PackageLimits
from app.modules.document.delivery_models import DocumentUpload
from app.modules.document.package import digest, safe_path, unpack


def fingerprint(request):
    return digest(json.dumps(request.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode())

class DocumentDelivery:
    def __init__(self, cloud):
        self.cloud = cloud
        self.session = cloud.session
        self.limits = PackageLimits.from_settings(cloud.settings)

    async def prepare(self, context, request):
        workspace = require(context, True)
        safe_path(request.filename)
        if request.size_bytes > self.limits.upload_bytes:
            raise ApplicationError("document_too_large", "Document exceeds delivery limit", 413)
        lock = int.from_bytes(bytes.fromhex(digest(f"delivery:{workspace}:{request.idempotency_key}".encode()))[:8], "big", signed=True)
        await self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
        record = await self.session.scalar(select(DocumentUpload).where(
            DocumentUpload.workspace_id == workspace,
            DocumentUpload.idempotency_key == request.idempotency_key).with_for_update())
        if record:
            if record.request_sha256 != fingerprint(request) or record.user_id != context.principal.user_id:
                raise ConflictError("upload_payload_conflict", "Upload intent has different content or owner")
        else:
            record = DocumentUpload(id=uuid4(), workspace_id=workspace, user_id=context.principal.user_id,
                idempotency_key=request.idempotency_key, request_sha256=fingerprint(request),
                metadata_payload=request.model_dump(mode="json"), uploaded=False, finalized=False)
            self.session.add(record)
        # Retrying prepare rotates the capability under the same row lock. Bytes and
        # target never change; expiry renewal requires fresh authenticated authority.
        capability = secrets.token_urlsafe(32)
        record.capability_sha256 = digest(capability.encode())
        record.expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        payload = {"upload_id": str(record.id), "expires_at": record.expires_at.isoformat(),
                   "method": "PUT", "header": "X-Document-Upload-Capability", "capability": capability,
                   "size_bytes": request.size_bytes, "source_sha256": request.source_sha256,
                   "uploaded": record.uploaded, "finalized": record.finalized,
                   "path": f"/api/organizations/{context.scope.organization_id}/workspaces/{workspace}/cloud-documents/uploads/{record.id}/content"}
        await self.session.commit()
        return payload

    async def intent(self, context, upload_id):
        workspace = require(context, True)
        record = await self.session.scalar(select(DocumentUpload).where(
            DocumentUpload.workspace_id == workspace, DocumentUpload.id == upload_id,
            DocumentUpload.user_id == context.principal.user_id).with_for_update())
        if record is None:
            raise NotFoundError("upload_not_found", "Upload intent not found")
        return record

    async def upload(self, context, upload_id, capability, chunks):
        record = await self.intent(context, upload_id)
        if (record.expires_at <= datetime.now(timezone.utc) or record.finalized or
            not hmac.compare_digest(record.capability_sha256, digest(capability.encode()))):
            raise ApplicationError("upload_capability_invalid", "Upload capability is unavailable", 403)
        request = PrepareUpload.model_validate(record.metadata_payload)
        raw = bytearray()
        async for chunk in chunks:
            if len(raw) + len(chunk) > min(request.size_bytes, self.limits.upload_bytes):
                raise ApplicationError("document_too_large", "Upload exceeds declared size", 413)
            raw.extend(chunk)
        if len(raw) != request.size_bytes or digest(raw) != request.source_sha256:
            raise ApplicationError("upload_integrity_mismatch", "Upload size or digest mismatch", 400)
        key = self.key(record)
        if not record.uploaded:
            await self.cloud.storage.put(key, bytes(raw), request.media_type)
        if digest(await self.cloud.storage.get(key)) != request.source_sha256:
            raise ApplicationError("storage_hash_mismatch", "Staged upload integrity failed", 503)
        record.uploaded = True
        await self.session.commit()
        return {"upload_id": str(record.id), "uploaded": True}

    @staticmethod
    def key(record):
        return f"workspaces/{record.workspace_id}/document-delivery/{record.id}"

    async def finalize(self, context, upload_id):
        record = await self.intent(context, upload_id)
        if not record.uploaded or (not record.finalized and record.expires_at <= datetime.now(timezone.utc)):
            raise ConflictError("upload_unavailable", "Upload is missing or expired; prepare again to renew")
        request = PrepareUpload.model_validate(record.metadata_payload)
        raw = await self.cloud.storage.get(self.key(record))
        if len(raw) != request.size_bytes or digest(raw) != request.source_sha256:
            raise ApplicationError("upload_integrity_mismatch", "Staged upload size or digest mismatch", 409)
        # The shared import commits this flag together with the revision and receipt.
        # Failed/ambiguous commits retain staging for an idempotent roll-forward.
        record.finalized = True
        return await self.cloud.import_bytes(context, request, raw)

    async def package(self, context, document_id, revision_number):
        workspace = require(context)
        if await self.cloud.repository.get(workspace, document_id) is None:
            raise NotFoundError("document_not_found", "Document not found")
        revision = await self.cloud.repository.get_revision(workspace, document_id, revision_number)
        if revision is None:
            raise NotFoundError("document_revision_not_found", "Document revision not found")
        if revision.media_type != "application/zip":
            raise ApplicationError("package_required", "Revision is not a ZIP package", 415)
        if revision.size_bytes > self.limits.upload_bytes:
            raise ApplicationError("document_too_large", "Package exceeds delivery limit", 413)
        raw = await self.cloud.storage.get(revision.storage_key)
        if len(raw) != revision.size_bytes or digest(raw) != revision.sha256:
            raise ApplicationError("source_hash_mismatch", "Stored revision integrity failed", 409)
        return revision, unpack(raw, revision.media_type, revision.filename, self.limits)

    async def manifest(self, context, document_id, revision_number):
        revision, files = await self.package(context, document_id, revision_number)
        pair = revision.revision_metadata.get("specification_pair")
        entry = pair["human_root"] + "/index.html" if pair else ("index.html" if "index.html" in files else None)
        return {"revision_id": str(revision.id), "revision_number": revision.revision_number,
                "source_sha256": revision.sha256, "human_entry": entry,
                "members": [{"path": name, "size_bytes": len(raw), "sha256": digest(raw)}
                            for name, raw in sorted(files.items())]}

    async def member(self, context, document_id, revision_number, path):
        require(context, permission="document.export")
        safe_path(path)
        _, files = await self.package(context, document_id, revision_number)
        if path not in files:
            raise NotFoundError("package_member_not_found", "Package member not found")
        return files[path]
