"""Document API schemas."""

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.document.models import DocumentStatus, DocumentType, ProvenanceRelation


class DocumentMetadataInput(BaseModel):
    metadata: dict[str, object] = Field(default_factory=dict)

    @field_validator("metadata")
    @classmethod
    def validate_explorer_path(cls, metadata: dict[str, object]) -> dict[str, object]:
        path = metadata.get("path")
        if path is not None and (
            not isinstance(path, str)
            or len(path) > 1024
            or re.search(r"[\\\x00-\x1f]", path)
            or any(part in {"", ".", ".."} for part in path.split("/"))
            or len(path.split("/")) > 32
        ):
            raise ValueError("metadata.path must be a relative document path (up to 32 levels)")
        return metadata


class DocumentCreate(DocumentMetadataInput):
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    document_type: DocumentType
    metadata: dict[str, object] = Field(default_factory=dict)


class DocumentUpdate(DocumentMetadataInput):
    title: str = Field(min_length=1, max_length=300)
    status: DocumentStatus
    metadata: dict[str, object] = Field(default_factory=dict)
    revision: int = Field(ge=1)


class DocumentResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    document_type: DocumentType
    title: str
    slug: str
    status: DocumentStatus
    document_metadata: dict[str, object]
    current_revision_number: int
    revision: int
    created_at: datetime
    updated_at: datetime


class DocumentRevisionResponse(BaseModel):
    id: UUID
    document_id: UUID
    revision_number: int
    filename: str
    media_type: str
    size_bytes: int
    sha256: str
    created_by_user_id: UUID
    revision_metadata: dict[str, object]
    created_at: datetime


class ProvenanceCreate(BaseModel):
    source_document_id: UUID
    target_document_id: UUID
    relation: ProvenanceRelation
    metadata: dict[str, object] = Field(default_factory=dict)

    @model_validator(mode="after")
    def reject_self_reference(self) -> "ProvenanceCreate":
        if self.source_document_id == self.target_document_id:
            raise ValueError("a document cannot derive from itself")
        return self


class ProvenanceResponse(BaseModel):
    id: UUID
    source_document_id: UUID
    target_document_id: UUID
    relation: ProvenanceRelation
    provenance_metadata: dict[str, object]
    created_at: datetime
