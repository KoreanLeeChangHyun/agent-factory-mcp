"""Database foundation tests that do not require a live PostgreSQL server."""

from agent_factory_adapters.postgres.database.base import NAMING_CONVENTION, Base


def test_constraint_names_are_deterministic() -> None:
    assert Base.metadata.naming_convention == NAMING_CONVENTION
    assert NAMING_CONVENTION["fk"].startswith("fk_")
