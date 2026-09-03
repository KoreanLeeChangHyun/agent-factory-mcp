"""Document API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.modules.document.models import DocumentStatus, DocumentType, ProvenanceRelation


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    document_type: DocumentType
    metadata: dict[str, object] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
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
