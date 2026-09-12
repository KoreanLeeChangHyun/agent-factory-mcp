from __future__ import annotations

import asyncio
import os
from uuid import UUID, uuid4

import pytest
from agent_factory_adapters import PostgresThemeProfileRepository
from agent_factory_core import (
    ThemeBase,
    ThemeConflictError,
    ThemeDensity,
    ThemeProfile,
    ThemeUpdate,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


class AuditFailingThemeRepository(PostgresThemeProfileRepository):
    async def _append_audit(self, profile: ThemeProfile) -> None:
        raise RuntimeError("deliberate audit failure")


def update(base: ThemeBase, expected_revision: int) -> ThemeUpdate:
    return ThemeUpdate(base, ThemeDensity.COMPACT, {}, False, expected_revision)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_theme_rls_audit_and_optimistic_concurrency() -> None:
    database_url = os.getenv("AGENT_FACTORY_TEST_DATABASE_URL")
    admin_url = os.getenv("AGENT_FACTORY_TEST_ADMIN_DATABASE_URL")
    if not database_url or not admin_url:
        pytest.skip("explicit disposable theme database URLs are not configured")
    first_user, audit_failure_user, isolated_user, race_user = (uuid4() for _ in range(4))
    users = (first_user, audit_failure_user, isolated_user, race_user)
    admin = create_async_engine(admin_url)
    async with admin.begin() as connection:
        for user_id in users:
            await connection.execute(
                text(
                    "INSERT INTO users (id, email, display_name) VALUES (:id, :email, 'Theme test')"
                ),
                {"id": user_id, "email": f"theme-{user_id.hex}@example.test"},
            )
    engine = create_async_engine(database_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            repository = PostgresThemeProfileRepository(session)
            created = await repository.save(first_user, update(ThemeBase.DARK, 0))
            assert created.revision == 1
            updated = await repository.save(first_user, update(ThemeBase.LIGHT, 1))
            assert updated.revision == 2
            with pytest.raises(ThemeConflictError) as conflict:
                await repository.save(first_user, update(ThemeBase.DARK, 1))
            assert conflict.value.current.revision == 2

        async with admin.connect() as connection:
            audit_rows = (
                (
                    await connection.execute(
                        text(
                            "SELECT event_metadata FROM audit_events "
                            "WHERE actor_user_id = :user_id AND action = 'appearance.theme.update' "
                            "ORDER BY occurred_at"
                        ),
                        {"user_id": first_user},
                    )
                )
                .mappings()
                .all()
            )
            assert [row["event_metadata"] for row in audit_rows] == [
                {"revision": 1},
                {"revision": 2},
            ]

        async with sessions() as session:
            failing = AuditFailingThemeRepository(session)
            saved_despite_audit_failure = await failing.save(
                audit_failure_user, update(ThemeBase.DARK, 0)
            )
            assert saved_despite_audit_failure.revision == 1
            assert (
                await PostgresThemeProfileRepository(session).get(audit_failure_user)
            ).revision == 1
        async with admin.connect() as connection:
            failed_audit_count = await connection.scalar(
                text(
                    "SELECT count(*) FROM audit_events "
                    "WHERE actor_user_id = :user_id AND action = 'appearance.theme.update'"
                ),
                {"user_id": audit_failure_user},
            )
            assert failed_audit_count == 0

        async def first_save() -> ThemeProfile | Exception:
            async with sessions() as session:
                try:
                    return await PostgresThemeProfileRepository(session).save(
                        race_user, update(ThemeBase.DARK, 0)
                    )
                except Exception as error:
                    return error

        race_results = await asyncio.gather(first_save(), first_save())
        assert len([result for result in race_results if isinstance(result, ThemeProfile)]) == 1
        conflicts = [result for result in race_results if isinstance(result, ThemeConflictError)]
        assert len(conflicts) == 1
        assert conflicts[0].current.revision == 1

        async with admin.connect() as connection:
            race_audit_rows = (
                (
                    await connection.execute(
                        text(
                            "SELECT event_metadata FROM audit_events "
                            "WHERE actor_user_id = :user_id "
                            "AND action = 'appearance.theme.update'"
                        ),
                        {"user_id": race_user},
                    )
                )
                .mappings()
                .all()
            )
            assert [row["event_metadata"] for row in race_audit_rows] == [{"revision": 1}]

        async with sessions() as session:
            await session.execute(
                text("SELECT set_config('app.current_user_id', :id, true)"),
                {"id": str(isolated_user)},
            )
            count = await session.scalar(text("SELECT count(*) FROM user_theme_profiles"))
            assert count == 0
    finally:
        await engine.dispose()
        await admin.dispose()
