from __future__ import annotations

import hmac
import json
import secrets
from collections.abc import AsyncIterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID

from .cloud import CloudImportCommand, CloudImportReceipt, CloudKnowledgeUseCases
from .domain import KnowledgeActor
from .errors import KnowledgeConflictError, KnowledgePermissionError, KnowledgeValidationError
from .packages import digest, safe_package_path
from .ports import ObjectStorage


@dataclass(frozen=True, slots=True)
class UploadIntent:
    id: UUID
    workspace_id: UUID
    user_id: UUID
    command: CloudImportCommand
    request_sha256: str
    capability_sha256: str
    expires_at: datetime
    size_bytes: int
    uploaded: bool
    finalized: bool


class UploadIntentRepository(Protocol):
    async def prepare(
        self,
        actor: KnowledgeActor,
        *,
        command: CloudImportCommand,
        request_sha256: str,
        capability_sha256: str,
        expires_at: datetime,
        size_bytes: int,
    ) -> UploadIntent: ...

    async def get_for_update(
        self, actor: KnowledgeActor, upload_id: UUID
    ) -> UploadIntent | None: ...
    async def mark_uploaded(self, actor: KnowledgeActor, upload_id: UUID) -> None: ...
    async def mark_finalized(self, actor: KnowledgeActor, upload_id: UUID) -> None: ...


def upload_fingerprint(command: CloudImportCommand, size_bytes: int) -> str:
    return digest(
        json.dumps(
            {"command": repr(command), "size_bytes": size_bytes},
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    )


class DocumentDeliveryUseCases:
    def __init__(
        self,
        repository: UploadIntentRepository,
        storage: ObjectStorage,
        importer: CloudKnowledgeUseCases,
        *,
        max_upload_bytes: int,
    ) -> None:
        self.repository, self.storage, self.importer = repository, storage, importer
        self.max_upload_bytes = max_upload_bytes

    @staticmethod
    def storage_key(intent: UploadIntent) -> str:
        return f"workspaces/{intent.workspace_id}/document-delivery/{intent.id}"

    async def prepare(
        self, actor: KnowledgeActor, command: CloudImportCommand, size_bytes: int
    ) -> tuple[UploadIntent, str]:
        if "document.import" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.import is required")
        safe_package_path(command.filename)
        if not 1 <= size_bytes <= self.max_upload_bytes:
            raise KnowledgeValidationError("document_too_large", "Upload exceeds delivery bounds")
        capability = secrets.token_urlsafe(32)
        intent = await self.repository.prepare(
            actor,
            command=command,
            request_sha256=upload_fingerprint(command, size_bytes),
            capability_sha256=digest(capability.encode()),
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
            size_bytes=size_bytes,
        )
        return intent, capability

    async def upload(
        self,
        actor: KnowledgeActor,
        upload_id: UUID,
        capability: str,
        chunks: AsyncIterable[bytes],
    ) -> None:
        intent = await self.repository.get_for_update(actor, upload_id)
        if intent is None:
            raise KnowledgeValidationError("upload_not_found", "Upload intent was not found")
        if (
            intent.expires_at <= datetime.now(UTC)
            or intent.finalized
            or not hmac.compare_digest(intent.capability_sha256, digest(capability.encode()))
        ):
            raise KnowledgePermissionError(
                "upload_capability_invalid", "Upload capability is unavailable"
            )
        content = bytearray()
        async for chunk in chunks:
            if len(content) + len(chunk) > min(intent.size_bytes, self.max_upload_bytes):
                raise KnowledgeValidationError("document_too_large", "Upload exceeds declared size")
            content.extend(chunk)
        if len(content) != intent.size_bytes or digest(content) != intent.command.source_sha256:
            raise KnowledgeValidationError(
                "upload_integrity_mismatch", "Upload size or digest differs"
            )
        key = self.storage_key(intent)
        await self.storage.put(key, bytes(content), intent.command.media_type)
        if digest(await self.storage.get(key)) != intent.command.source_sha256:
            raise KnowledgeValidationError("storage_hash_mismatch", "Staged upload differs")
        await self.repository.mark_uploaded(actor, intent.id)

    async def finalize(self, actor: KnowledgeActor, upload_id: UUID) -> CloudImportReceipt:
        intent = await self.repository.get_for_update(actor, upload_id)
        if intent is None:
            raise KnowledgeValidationError("upload_not_found", "Upload intent was not found")
        if not intent.uploaded or (not intent.finalized and intent.expires_at <= datetime.now(UTC)):
            raise KnowledgeConflictError("upload_unavailable", "Upload is missing or expired")
        content = await self.storage.get(self.storage_key(intent))
        if len(content) != intent.size_bytes or digest(content) != intent.command.source_sha256:
            raise KnowledgeValidationError("upload_integrity_mismatch", "Staged upload differs")
        receipt = await self.importer.import_bytes(actor, intent.command, content)
        await self.repository.mark_finalized(actor, intent.id)
        return receipt
