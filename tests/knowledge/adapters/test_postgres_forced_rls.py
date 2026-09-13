from __future__ import annotations

import os
from uuid import UUID, uuid4

import pytest
from agent_factory_adapters.pgvector.knowledge.search import PgvectorSearchRepository
from agent_factory_adapters.postgres.knowledge.cloud import PostgresCloudKnowledgeRepository
from agent_factory_adapters.postgres.knowledge.repository import PostgresKnowledgeRepository
from agent_factory_core.knowledge.domain import DocumentType, KnowledgeActor
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("AGENT_FACTORY_TEST_DATABASE_URL")
ORGANIZATION_ID = os.getenv("AF_KNOWLEDGE_TEST_ORGANIZATION_ID")
WORKSPACE_ID = os.getenv("AF_KNOWLEDGE_TEST_WORKSPACE_ID")
USER_ID = os.getenv("AF_KNOWLEDGE_TEST_USER_ID")

pytestmark = pytest.mark.skipif(
    not all((DATABASE_URL, ORGANIZATION_ID, WORKSPACE_ID, USER_ID)),
    reason="fresh forced-RLS knowledge fixture was not supplied",
)


@pytest.mark.asyncio
async def test_document_and_profile_mutations_append_audit_as_forced_rls_app_role() -> None:
    assert DATABASE_URL and ORGANIZATION_ID and WORKSPACE_ID and USER_ID
    engine = create_async_engine(DATABASE_URL)
    actor = KnowledgeActor(
        UUID(USER_ID),
        UUID(ORGANIZATION_ID),
        UUID(WORKSPACE_ID),
        frozenset({"document.create", "document.update", "document.read"}),
    )
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        role = (
            await session.execute(
                text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user")
            )
        ).one()
        assert role == (False, False)
        suffix = uuid4().hex[:12]
        document = await PostgresKnowledgeRepository(session).create_document(
            actor,
            title="forced RLS",
            slug=f"forced-rls-{suffix}",
            document_type=DocumentType.ORIGINAL,
            metadata={},
        )
        profile = await PgvectorSearchRepository(session).create_profile(
            actor,
            name=f"forced-rls-{suffix}",
            provider="deterministic",
            model="fixture",
            dimensions=1536,
        )
        actions = set(
            await session.scalars(
                text(
                    "SELECT action FROM audit_events WHERE workspace_id=:workspace_id "
                    "AND target_id IN (:document_id, :profile_id)"
                ),
                {
                    "workspace_id": actor.workspace_id,
                    "document_id": str(document.id),
                    "profile_id": str(profile.id),
                },
            )
        )
        assert actions == {"document.create", "document.search_profile.create"}

        first = await PostgresKnowledgeRepository(session).reserve_revision(
            actor,
            document.id,
            storage_key=f"forced-rls/{suffix}/one",
            filename="one.md",
            media_type="text/markdown",
            content_sha256="1" * 64,
            size_bytes=3,
            metadata={},
        )
        second = await PostgresKnowledgeRepository(session).reserve_revision(
            actor,
            document.id,
            storage_key=f"forced-rls/{suffix}/two",
            filename="two.md",
            media_type="text/markdown",
            content_sha256="2" * 64,
            size_bytes=3,
            metadata={},
        )
        lexical = PostgresCloudKnowledgeRepository(session)
        await lexical.replace_lexical_chunks(
            actor,
            document_id=document.id,
            revision_number=first.revision_number,
            chunks=[("one.md", f"old lexical_{suffix}")],
        )
        await lexical.replace_lexical_chunks(
            actor,
            document_id=document.id,
            revision_number=second.revision_number,
            chunks=[("two.md", f"current lexical_{suffix}")],
        )
        hits = await lexical.lexical_search(actor, terms=[f"lexical_{suffix}"], limit=20)
        assert [(hit.revision_id, hit.content) for hit in hits] == [
            (second.id, f"current lexical_{suffix}")
        ]
    await engine.dispose()
