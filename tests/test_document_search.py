"""Document chunking and embedding-provider policy tests."""

import pytest
from pydantic import SecretStr

from app.common.errors import ApplicationError
from app.core.config import Settings
from app.infrastructure.embeddings import (
    DeterministicEmbeddingProvider,
    build_embedding_provider,
)
from app.modules.document.search_service import split_text


def test_text_chunking_is_stable_and_overlapping() -> None:
    chunks = split_text("abcdefghij", size=6, overlap=2)

    assert chunks == ["abcdef", "efghij"]


def test_text_chunking_prefers_line_boundaries() -> None:
    chunks = split_text("alpha\nbeta\ngamma", size=11, overlap=2)

    assert chunks[0] == "alpha\nbeta"
    assert chunks[1].endswith("gamma")


@pytest.mark.asyncio
async def test_deterministic_embeddings_are_normalized_and_repeatable() -> None:
    provider = DeterministicEmbeddingProvider(dimensions=8)

    first, second = await provider.embed(["same", "same"])

    assert first == second
    assert sum(value * value for value in first) == pytest.approx(1)


@pytest.mark.asyncio
async def test_deterministic_provider_is_for_local_or_test_only() -> None:
    local = Settings(
        environment="test",
        embedding_provider="deterministic",
        auth_token_secret=SecretStr("test-secret"),
    )
    assert build_embedding_provider(local).dimensions == 1536

    production = Settings(
        environment="production",
        embedding_provider="deterministic",
        auth_token_secret=SecretStr("a" * 32),
        session_cookie_secure=True,
        public_base_url="https://example.com",
    )
    with pytest.raises(ApplicationError, match="not configured"):
        await build_embedding_provider(production).embed(["blocked"])
