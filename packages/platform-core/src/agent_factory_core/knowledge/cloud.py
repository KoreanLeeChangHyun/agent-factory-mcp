from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID, uuid4

from .domain import DocumentType, KnowledgeActor
from .errors import KnowledgeNotFoundError, KnowledgePermissionError, KnowledgeValidationError
from .packages import PackageLimits, digest, extract_text, unpack_package
from .ports import ObjectStorage
from .specification_pair import SpecificationPair, validate_specification_pair


@dataclass(frozen=True, slots=True)
class CloudImportCommand:
    idempotency_key: str
    document_id: UUID | None
    expected_revision: int
    title: str
    slug: str
    document_type: DocumentType
    filename: str
    media_type: str
    source_sha256: str
    source_identity: str
    collection_context: str
    pair: SpecificationPair | None = None


@dataclass(frozen=True, slots=True)
class CloudImportReceipt:
    document_id: UUID
    revision_id: UUID
    revision_number: int
    request_sha256: str


@dataclass(frozen=True, slots=True)
class LexicalHit:
    document_id: UUID
    revision_id: UUID
    source_path: str
    content: str


@dataclass(frozen=True, slots=True)
class CloudRevisionSource:
    document_id: UUID
    revision_id: UUID
    revision_number: int
    storage_key: str
    filename: str
    media_type: str
    size_bytes: int
    sha256: str


class CloudKnowledgeRepository(Protocol):
    async def get_revision_source(
        self, actor: KnowledgeActor, *, document_id: UUID, revision_number: int
    ) -> CloudRevisionSource | None: ...

    async def publish_import(
        self,
        actor: KnowledgeActor,
        *,
        command: CloudImportCommand,
        command_sha256: str,
        document_id: UUID,
        revision_id: UUID,
        storage_key: str,
        size_bytes: int,
        revision_metadata: Mapping[str, object],
        chunks: Sequence[tuple[str, str]],
    ) -> CloudImportReceipt: ...

    async def replace_lexical_chunks(
        self,
        actor: KnowledgeActor,
        *,
        document_id: UUID,
        revision_number: int,
        chunks: Sequence[tuple[str, str]],
    ) -> int: ...

    async def lexical_search(
        self, actor: KnowledgeActor, *, terms: Sequence[str], limit: int
    ) -> Sequence[LexicalHit]: ...


def _fingerprint(command: CloudImportCommand) -> str:
    value = {
        "idempotency_key": command.idempotency_key,
        "document_id": str(command.document_id) if command.document_id else None,
        "expected_revision": command.expected_revision,
        "title": command.title,
        "slug": command.slug,
        "document_type": command.document_type.value,
        "filename": command.filename,
        "media_type": command.media_type,
        "source_sha256": command.source_sha256,
        "source_identity": command.source_identity,
        "collection_context": command.collection_context,
        "pair": repr(command.pair),
    }
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


class CloudKnowledgeUseCases:
    def __init__(
        self, repository: CloudKnowledgeRepository, storage: ObjectStorage, limits: PackageLimits
    ) -> None:
        self.repository, self.storage, self.limits = repository, storage, limits

    async def import_bytes(
        self, actor: KnowledgeActor, command: CloudImportCommand, content: bytes
    ) -> CloudImportReceipt:
        if "document.import" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.import is required")
        if digest(content) != command.source_sha256:
            raise KnowledgeValidationError("source_hash_mismatch", "Source digest differs")
        files = unpack_package(content, command.media_type, command.filename, self.limits)
        pair_metadata: Mapping[str, object] | None = None
        if command.document_type is DocumentType.SPECIFICATION:
            if command.pair is None or command.media_type != "application/zip":
                raise KnowledgeValidationError(
                    "pair_required", "Specification requires a reviewed pair"
                )
            pair_metadata = validate_specification_pair(files, command.pair, command.slug)
        elif command.pair is not None:
            raise KnowledgeValidationError(
                "pair_type_mismatch", "Only Specifications accept a pair"
            )
        chunks = extract_text(files, command.media_type)
        document_id, revision_id = command.document_id or uuid4(), uuid4()
        storage_key = (
            f"workspaces/{actor.workspace_id}/documents/{document_id}/imports/{revision_id}"
        )
        metadata: dict[str, object] = {
            "cloud_schema_version": "1",
            "source_identity": command.source_identity,
            "source_sha256": command.source_sha256,
            "collection_context": command.collection_context,
            "files": {path: digest(value) for path, value in sorted(files.items())},
        }
        if pair_metadata:
            metadata["specification_pair"] = dict(pair_metadata)
        await self.storage.put(storage_key, content, command.media_type)
        stored = await self.storage.get(storage_key)
        if digest(stored) != command.source_sha256:
            raise KnowledgeValidationError("storage_hash_mismatch", "Staged bytes differ")
        # All failures retain the unique object: commit acknowledgement may be ambiguous.
        return await self.repository.publish_import(
            actor,
            command=command,
            command_sha256=_fingerprint(command),
            document_id=document_id,
            revision_id=revision_id,
            storage_key=storage_key,
            size_bytes=len(content),
            revision_metadata=metadata,
            chunks=chunks,
        )

    async def index(self, actor: KnowledgeActor, *, document_id: UUID, revision_number: int) -> int:
        if "document.update" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.update is required")
        if revision_number < 1:
            raise KnowledgeValidationError("invalid_revision", "Revision number must be positive")
        revision = await self.repository.get_revision_source(
            actor, document_id=document_id, revision_number=revision_number
        )
        if revision is None:
            raise KnowledgeNotFoundError("document_revision_not_found", "Revision not found")
        if revision.media_type not in {
            "text/plain",
            "text/markdown",
            "text/csv",
            "text/html",
            "application/json",
            "application/zip",
        }:
            raise KnowledgeValidationError(
                "document_not_searchable", "Revision media type cannot be indexed"
            )
        content = await self.storage.get(revision.storage_key)
        if len(content) != revision.size_bytes or digest(content) != revision.sha256:
            raise KnowledgeValidationError(
                "source_hash_mismatch", "Stored revision integrity failed"
            )
        files = unpack_package(content, revision.media_type, revision.filename, self.limits)
        chunks = extract_text(files, revision.media_type)
        return await self.repository.replace_lexical_chunks(
            actor,
            document_id=document_id,
            revision_number=revision_number,
            chunks=chunks,
        )

    async def search(
        self, actor: KnowledgeActor, query: str, limit: int = 20
    ) -> Sequence[LexicalHit]:
        if "document.read" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.read is required")
        terms = query.strip().split()
        if not terms or len(query) > 300 or len(terms) > 16 or not 1 <= limit <= 100:
            raise KnowledgeValidationError("invalid_search", "Search query is outside bounds")
        return await self.repository.lexical_search(actor, terms=terms, limit=limit)
