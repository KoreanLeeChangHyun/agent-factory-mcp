from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from uuid import UUID, uuid4

from agent_factory_adapters.postgres.knowledge.audit import append_knowledge_audit
from agent_factory_core.knowledge.domain import EmbeddingProfile, KnowledgeActor, SearchHit
from agent_factory_core.knowledge.errors import KnowledgeConflictError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class PgvectorSearchRepository:
    def __init__(
        self, session: AsyncSession, *, request_id: str | None = None, source: str = "http"
    ) -> None:
        self.session = session
        self.request_id = request_id
        self.source = source

    async def _context(self, actor: KnowledgeActor) -> None:
        for key, value in (
            ("app.current_user_id", actor.user_id),
            ("app.current_organization_id", actor.organization_id),
            ("app.current_workspace_id", actor.workspace_id),
        ):
            await self.session.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": str(value)}
            )
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', 'false', true)")
        )

    @staticmethod
    def _profile(row: Mapping[str, object]) -> EmbeddingProfile:
        return EmbeddingProfile(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            str(row["name"]),
            str(row["provider"]),
            str(row["model"]),
            int(str(row["dimensions"])),
            bool(row["is_active"]),
        )

    async def create_profile(
        self, actor: KnowledgeActor, *, name: str, provider: str, model: str, dimensions: int
    ) -> EmbeddingProfile:
        await self._context(actor)
        profile_id = uuid4()
        try:
            row = (
                (
                    await self.session.execute(
                        text(
                            "INSERT INTO embedding_profiles (id, workspace_id, name, provider, model, dimensions, is_active, created_at, updated_at) VALUES (:id, :workspace_id, :name, :provider, :model, :dimensions, true, now(), now()) RETURNING id, workspace_id, name, provider, model, dimensions, is_active"
                        ),
                        {
                            "id": profile_id,
                            "workspace_id": actor.workspace_id,
                            "name": name,
                            "provider": provider,
                            "model": model,
                            "dimensions": dimensions,
                        },
                    )
                )
                .mappings()
                .one()
            )
            await append_knowledge_audit(
                self.session,
                actor,
                action="document.search_profile.create",
                target_type="embedding_profile",
                target_id=profile_id,
                request_id=self.request_id,
                source=self.source,
            )
            await self.session.commit()
            return self._profile(row)
        except IntegrityError as error:
            await self.session.rollback()
            raise KnowledgeConflictError(
                "embedding_profile_exists", "Embedding profile already exists"
            ) from error

    async def list_profiles(self, actor: KnowledgeActor) -> Sequence[EmbeddingProfile]:
        await self._context(actor)
        rows = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, name, provider, model, dimensions, is_active FROM embedding_profiles WHERE workspace_id=:workspace_id ORDER BY name"
                    ),
                    {"workspace_id": actor.workspace_id},
                )
            )
            .mappings()
            .all()
        )
        return [self._profile(row) for row in rows]

    async def get_profile(self, actor: KnowledgeActor, profile_id: UUID) -> EmbeddingProfile | None:
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, name, provider, model, dimensions, is_active FROM embedding_profiles WHERE workspace_id=:workspace_id AND id=:id AND is_active"
                    ),
                    {"workspace_id": actor.workspace_id, "id": profile_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._profile(row) if row else None

    async def replace_chunks(
        self,
        actor: KnowledgeActor,
        *,
        document_id: UUID,
        revision_id: UUID,
        profile_id: UUID,
        contents: Sequence[str],
        vectors: Sequence[Sequence[float]],
    ) -> None:
        await self._context(actor)
        await self.session.execute(
            text(
                "DELETE FROM document_chunks WHERE workspace_id=:workspace_id AND document_id=:document_id AND embedding_profile_id=:profile_id"
            ),
            {
                "workspace_id": actor.workspace_id,
                "document_id": document_id,
                "profile_id": profile_id,
            },
        )
        for index, (content, vector) in enumerate(zip(contents, vectors, strict=True)):
            await self.session.execute(
                text(
                    "INSERT INTO document_chunks (id, workspace_id, document_id, document_revision_id, embedding_profile_id, chunk_index, content, token_count, embedding, chunk_metadata, created_at, updated_at) VALUES (:id, :workspace_id, :document_id, :revision_id, :profile_id, :chunk_index, :content, NULL, CAST(:embedding AS vector), CAST(:metadata AS jsonb), now(), now())"
                ),
                {
                    "id": uuid4(),
                    "workspace_id": actor.workspace_id,
                    "document_id": document_id,
                    "revision_id": revision_id,
                    "profile_id": profile_id,
                    "chunk_index": index,
                    "content": content,
                    "embedding": "[" + ",".join(str(float(item)) for item in vector) + "]",
                    "metadata": json.dumps({}, separators=(",", ":")),
                },
            )
        await append_knowledge_audit(
            self.session,
            actor,
            action="document.index.replace",
            target_type="document",
            target_id=document_id,
            request_id=self.request_id,
            source=self.source,
            metadata={"embedding_profile_id": str(profile_id), "chunks": len(contents)},
        )
        await self.session.commit()

    async def hybrid_search(
        self,
        actor: KnowledgeActor,
        *,
        profile_id: UUID,
        query: str,
        vector: Sequence[float],
        limit: int,
    ) -> Sequence[SearchHit]:
        await self._context(actor)
        rows = (
            (
                await self.session.execute(
                    text(
                        "SELECT c.id, c.document_id, c.document_revision_id, c.content, c.chunk_metadata, 1-(c.embedding <=> CAST(:embedding AS vector)) AS semantic_score, ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', :query)) AS lexical_score FROM document_chunks c JOIN documents d ON d.id=c.document_id AND d.workspace_id=c.workspace_id AND d.deleted_at IS NULL JOIN document_revisions r ON r.id=c.document_revision_id AND r.revision_number=d.current_revision_number WHERE c.workspace_id=:workspace_id AND c.embedding_profile_id=:profile_id ORDER BY ((1-(c.embedding <=> CAST(:embedding AS vector)))*0.7 + ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', :query))*0.3) DESC, c.id LIMIT :limit"
                    ),
                    {
                        "embedding": "[" + ",".join(str(float(item)) for item in vector) + "]",
                        "query": query,
                        "workspace_id": actor.workspace_id,
                        "profile_id": profile_id,
                        "limit": limit,
                    },
                )
            )
            .mappings()
            .all()
        )
        return [
            SearchHit(
                chunk_id=UUID(str(row["id"])),
                document_id=UUID(str(row["document_id"])),
                document_revision_id=UUID(str(row["document_revision_id"])),
                content=str(row["content"]),
                score=float(row["semantic_score"]) * 0.7 + float(row["lexical_score"]) * 0.3,
                semantic_score=float(row["semantic_score"]),
                lexical_score=float(row["lexical_score"]),
                metadata=dict(
                    row["chunk_metadata"] if isinstance(row["chunk_metadata"], Mapping) else {}
                ),
            )
            for row in rows
        ]
