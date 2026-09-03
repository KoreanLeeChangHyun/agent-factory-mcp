"""pgvector and PostgreSQL full-text persistence/query operations."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.document.models import DocumentChunk, DocumentRevision, EmbeddingProfile


class SearchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_profile(
        self, workspace_id: UUID, name: str, provider: str, model: str, dimensions: int
    ) -> EmbeddingProfile:
        profile = EmbeddingProfile(
            workspace_id=workspace_id,
            name=name,
            provider=provider,
            model=model,
            dimensions=dimensions,
        )
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def list_profiles(self, workspace_id: UUID) -> list[EmbeddingProfile]:
        return list(
            await self.session.scalars(
                select(EmbeddingProfile)
                .where(EmbeddingProfile.workspace_id == workspace_id)
                .order_by(EmbeddingProfile.name)
            )
        )

    async def get_profile(self, workspace_id: UUID, profile_id: UUID) -> EmbeddingProfile | None:
        return await self.session.scalar(
            select(EmbeddingProfile).where(
                EmbeddingProfile.id == profile_id,
                EmbeddingProfile.workspace_id == workspace_id,
                EmbeddingProfile.is_active.is_(True),
            )
        )

    async def get_revision(
        self, workspace_id: UUID, document_id: UUID, revision_id: UUID
    ) -> DocumentRevision | None:
        return await self.session.scalar(
            select(DocumentRevision).where(
                DocumentRevision.id == revision_id,
                DocumentRevision.document_id == document_id,
                DocumentRevision.workspace_id == workspace_id,
            )
        )

    async def replace_chunks(
        self,
        workspace_id: UUID,
        document_id: UUID,
        revision_id: UUID,
        profile_id: UUID,
        contents: list[str],
        vectors: list[list[float]],
    ) -> None:
        await self.session.execute(
            delete(DocumentChunk).where(
                DocumentChunk.workspace_id == workspace_id,
                DocumentChunk.document_id == document_id,
                DocumentChunk.embedding_profile_id == profile_id,
            )
        )
        self.session.add_all(
            [
                DocumentChunk(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    document_revision_id=revision_id,
                    embedding_profile_id=profile_id,
                    chunk_index=index,
                    content=content,
                    token_count=None,
                    embedding=vector,
                    chunk_metadata={},
                )
                for index, (content, vector) in enumerate(zip(contents, vectors, strict=True))
            ]
        )
        await self.session.flush()

    async def hybrid_search(
        self,
        workspace_id: UUID,
        profile_id: UUID,
        query: str,
        vector: list[float],
        limit: int,
    ) -> list[tuple[DocumentChunk, float, float]]:
        semantic = (1 - DocumentChunk.embedding.cosine_distance(vector)).label("semantic_score")
        query_vector = func.websearch_to_tsquery("simple", query)
        lexical = func.ts_rank_cd(DocumentChunk.search_vector, query_vector).label("lexical_score")
        score = (semantic * 0.7 + lexical * 0.3).label("score")
        rows = await self.session.execute(
            select(DocumentChunk, semantic, lexical)
            .where(
                DocumentChunk.workspace_id == workspace_id,
                DocumentChunk.embedding_profile_id == profile_id,
            )
            .order_by(score.desc())
            .limit(limit)
        )
        return [(row[0], float(row[1]), float(row[2])) for row in rows]

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
