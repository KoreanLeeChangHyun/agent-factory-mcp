"""Database foundation tests that do not require a live PostgreSQL server."""

from pathlib import Path

from app.db.base import NAMING_CONVENTION, Base


def test_constraint_names_are_deterministic() -> None:
    assert Base.metadata.naming_convention == NAMING_CONVENTION
    assert NAMING_CONVENTION["fk"].startswith("fk_")


def test_initial_migration_enables_pgvector() -> None:
    migration = Path("app/db/migrations/versions/0001_enable_extensions.py").read_text()

    assert "CREATE EXTENSION IF NOT EXISTS vector" in migration
    assert "DROP EXTENSION IF EXISTS vector" in migration
