"""Document persistence under a workspace tenant context."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.document.models import (
    Document,
    DocumentProvenance,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    ProvenanceRelation,
)


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, workspace_id: UUID, document_type: DocumentType | None) -> list[Document]:
        statement = select(Document).where(
            Document.workspace_id == workspace_id, Document.deleted_at.is_(None)
        )
        if document_type is not None:
            statement = statement.where(Document.document_type == document_type)
        return list(await self.session.scalars(statement.order_by(Document.updated_at.desc())))

    async def get(self, workspace_id: UUID, document_id: UUID) -> Document | None:
        return await self.session.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.workspace_id == workspace_id,
                Document.deleted_at.is_(None),
            )
        )

    async def create(
        self,
        workspace_id: UUID,
        title: str,
        slug: str,
        document_type: DocumentType,
        metadata: dict[str, object],
    ) -> Document:
        record = Document(
            workspace_id=workspace_id,
            title=title,
            slug=slug,
            document_type=document_type,
            document_metadata=metadata,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def update(
        self,
        workspace_id: UUID,
        document_id: UUID,
        title: str,
        status: DocumentStatus,
        metadata: dict[str, object],
        revision: int,
    ) -> Document | None:
        return await self.session.scalar(
            update(Document)
            .where(
                Document.id == document_id,
                Document.workspace_id == workspace_id,
                Document.revision == revision,
                Document.deleted_at.is_(None),
            )
            .values(
                title=title,
                status=status,
                document_metadata=metadata,
                revision=Document.revision + 1,
            )
            .returning(Document)
        )

    async def next_revision_number(self, document_id: UUID) -> int:
        current = await self.session.scalar(
            select(Document.current_revision_number)
            .where(Document.id == document_id)
            .with_for_update()
        )
        return int(current or 0) + 1

    async def add_revision(self, record: DocumentRevision) -> None:
        self.session.add(record)
        await self.session.execute(
            update(Document)
            .where(Document.id == record.document_id)
            .values(
                current_revision_number=record.revision_number,
                revision=Document.revision + 1,
            )
        )
        await self.session.flush()

    async def list_revisions(self, workspace_id: UUID, document_id: UUID) -> list[DocumentRevision]:
        return list(
            await self.session.scalars(
                select(DocumentRevision)
                .where(
                    DocumentRevision.workspace_id == workspace_id,
                    DocumentRevision.document_id == document_id,
                )
                .order_by(DocumentRevision.revision_number.desc())
            )
        )

    async def get_revision(
        self, workspace_id: UUID, document_id: UUID, revision_number: int
    ) -> DocumentRevision | None:
        return await self.session.scalar(
            select(DocumentRevision).where(
                DocumentRevision.workspace_id == workspace_id,
                DocumentRevision.document_id == document_id,
                DocumentRevision.revision_number == revision_number,
            )
        )

    async def add_provenance(
        self,
        workspace_id: UUID,
        source_document_id: UUID,
        target_document_id: UUID,
        relation: ProvenanceRelation,
        metadata: dict[str, object],
    ) -> DocumentProvenance:
        record = DocumentProvenance(
            workspace_id=workspace_id,
            source_document_id=source_document_id,
            target_document_id=target_document_id,
            relation=relation,
            provenance_metadata=metadata,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def list_provenance(
        self, workspace_id: UUID, document_id: UUID
    ) -> list[DocumentProvenance]:
        return list(
            await self.session.scalars(
                select(DocumentProvenance)
                .where(
                    DocumentProvenance.workspace_id == workspace_id,
                    (DocumentProvenance.source_document_id == document_id)
                    | (DocumentProvenance.target_document_id == document_id),
                )
                .order_by(DocumentProvenance.created_at)
            )
        )

    async def soft_delete(self, workspace_id: UUID, document_id: UUID) -> bool:
        from datetime import UTC, datetime

        result = await self.session.execute(
            update(Document)
            .where(
                Document.id == document_id,
                Document.workspace_id == workspace_id,
                Document.deleted_at.is_(None),
            )
            .values(deleted_at=datetime.now(UTC), revision=Document.revision + 1)
        )
        return bool(result.rowcount)

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
