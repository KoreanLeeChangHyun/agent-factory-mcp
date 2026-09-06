"""Closed v1 cloud document import and publication inputs."""
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.modules.document.models import DocumentType

MAX_BYTES = 4 * 1024 * 1024
INLINE_MAX_BYTES = 256 * 1024

class Closed(BaseModel):
    model_config = ConfigDict(extra="forbid")

class Review(Closed):
    reviewer: str = Field(min_length=1, max_length=200)
    evidence: str = Field(min_length=20, max_length=16000)
    authority_reference: str = Field(min_length=1, max_length=2000)
    ai_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    human_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    verdict: Literal["aligned"]

class Pair(Closed):
    specification_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=64)
    ai_root: str = Field(min_length=1, max_length=512)
    human_root: str = Field(min_length=1, max_length=512)
    git_repository: str = Field(min_length=1, max_length=2000)
    git_commit: str = Field(pattern=r"^(?:[a-f0-9]{40}|[a-f0-9]{64})$")
    review: Review

class ImportMetadata(Closed):
    schema_version: Literal["1"]
    idempotency_key: str = Field(min_length=1, max_length=160)
    document_id: UUID | None = None
    expected_revision: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    document_type: DocumentType
    filename: str = Field(min_length=1, max_length=255)
    media_type: Literal["text/plain", "text/markdown", "text/csv", "application/json", "application/zip", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg", "image/gif", "image/webp"]
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_identity: str = Field(min_length=1, max_length=2000)
    collection_context: str = Field(min_length=1, max_length=8000)
    pair: Pair | None = None

class ImportRequest(ImportMetadata):
    content_base64: str = Field(min_length=1, max_length=4 * ((INLINE_MAX_BYTES + 2) // 3))

class PrepareUpload(ImportMetadata):
    size_bytes: int = Field(ge=1, le=128 * 1024 * 1024)

class FinalizeUpload(Closed):
    schema_version: Literal["1"]
    upload_id: UUID

class ReadRequest(Closed):
    schema_version: Literal["1"]
    operation: Literal["get", "revisions", "provenance", "download"]
    document_id: UUID
    revision_number: int = Field(default=1, ge=1)

class SearchRequest(Closed):
    schema_version: Literal["1"]
    query: str = Field(min_length=1, max_length=300)
    limit: int = Field(default=20, ge=1, le=100)

class IndexRequest(Closed):
    schema_version: Literal["1"]
    document_id: UUID
    revision_number: int = Field(ge=1)

from typing import Annotated
from app.modules.document.schemas import DocumentCreate, DocumentUpdate, ProvenanceCreate

class Create(Closed, DocumentCreate):
    schema_version: Literal["1"]
    operation: Literal["create"]

class Update(Closed, DocumentUpdate):
    schema_version: Literal["1"]
    operation: Literal["update"]
    document_id: UUID

class Delete(Closed):
    schema_version: Literal["1"]
    operation: Literal["delete"]
    document_id: UUID

class Provenance(Closed, ProvenanceCreate):
    schema_version: Literal["1"]
    operation: Literal["provenance"]

WriteRequest = Annotated[Create | Update | Delete | Provenance, Field(discriminator="operation")]
