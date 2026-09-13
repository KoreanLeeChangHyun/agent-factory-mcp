import os
from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from agent_factory_adapters.postgres.scheduling.execution_lease import PostgresExecutionLeaseFactory
from agent_factory_adapters.postgres.scheduling.repository import PostgresSchedulingRepository
from agent_factory_core.executions.scheduling.domain import JobStatus, new_job
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, create_async_engine


async def _role_attributes(connection: AsyncConnection) -> tuple[str, bool, bool]:
    row = (
        await connection.execute(
            text(
                "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
            )
        )
    ).one()
    return str(row.rolname), bool(row.rolsuper), bool(row.rolbypassrls)


async def _establish_application_tenant(
    connection: AsyncConnection,
    organization_id: UUID,
    workspace_id: UUID,
    user_id: UUID,
) -> None:
    await connection.execute(
        text(
            "SELECT set_config('app.current_organization_id', :oid, true), "
            "set_config('app.current_workspace_id', :wid, true), "
            "set_config('app.current_user_id', :uid, true), "
            "set_config('app.is_platform_admin', 'false', true)"
        ),
        {"oid": str(organization_id), "wid": str(workspace_id), "uid": str(user_id)},
    )


@pytest.mark.asyncio
async def test_execution_lease_keeps_claim_connection_and_reapplies_tenant() -> None:
    admin_url = os.getenv("AGENT_FACTORY_TEST_ADMIN_DATABASE_URL")
    worker_url = os.getenv("AGENT_FACTORY_TEST_WORKER_DATABASE_URL")
    application_url = os.getenv("AGENT_FACTORY_TEST_DATABASE_URL")
    if not admin_url or not worker_url or not application_url:
        pytest.skip(
            "distinct AGENT_FACTORY_TEST_ADMIN_DATABASE_URL, "
            "AGENT_FACTORY_TEST_WORKER_DATABASE_URL, and "
            "AGENT_FACTORY_TEST_DATABASE_URL are required"
        )
    admin_engine = create_async_engine(admin_url)
    worker_engine = create_async_engine(worker_url)
    application_engine = create_async_engine(application_url)
    job = new_job(
        organization_id=uuid4(),
        workspace_id=uuid4(),
        user_id=uuid4(),
        task_type="system.noop",
        queue="default",
        payload={},
        idempotency_key="execution-lease-test",
        priority=5,
        max_attempts=1,
    )
    setup_connection = await admin_engine.connect()
    setup_session = AsyncSession(bind=setup_connection, expire_on_commit=False)
    lock_connection = await worker_engine.connect()
    application_connection = await application_engine.connect()
    lease = None
    lease_closed = False
    try:
        admin_role = await _role_attributes(setup_connection)
        worker_role = await _role_attributes(lock_connection)
        application_role = await _role_attributes(application_connection)
        assert admin_role[1:] == (True, True)
        assert worker_role[1:] == (False, True)
        assert application_role[1:] == (False, False)
        assert len({admin_role[0], worker_role[0], application_role[0]}) == 3
        forced_rls = (
            await setup_connection.execute(
                text(
                    "SELECT relname, relrowsecurity, relforcerowsecurity "
                    "FROM pg_class WHERE relname IN ('jobs', 'job_events') ORDER BY relname"
                )
            )
        ).all()
        assert [
            (row.relname, row.relrowsecurity, row.relforcerowsecurity) for row in forced_rls
        ] == [
            ("job_events", True, True),
            ("jobs", True, True),
        ]
        await setup_connection.commit()

        await setup_session.execute(
            text("INSERT INTO users (id,email,display_name) VALUES (:id,:email,'Lease test')"),
            {"id": job.requested_by_user_id, "email": f"lease-{job.id}@example.com"},
        )
        await setup_session.execute(
            text(
                "INSERT INTO organizations (id,name,slug,is_personal) "
                "VALUES (:id,'Lease test',:slug,false)"
            ),
            {"id": job.organization_id, "slug": f"lease-{job.id}"},
        )
        await setup_session.execute(
            text(
                "INSERT INTO workspaces (id,organization_id,name,slug) "
                "VALUES (:id,:oid,'Lease test',:slug)"
            ),
            {"id": job.workspace_id, "oid": job.organization_id, "slug": f"lease-{job.id}"},
        )
        await PostgresSchedulingRepository(setup_session).insert_job(job)
        await setup_session.commit()
        await lock_connection.rollback()
        await application_connection.rollback()

        key = f"agent-factory-job:{job.id}"
        lease = await PostgresExecutionLeaseFactory(worker_engine).acquire(job.id)
        assert lease is not None
        session = lease.session
        repository = lease.repository
        assert not await lock_connection.scalar(
            text("SELECT pg_try_advisory_lock(hashtextextended(:key,0))"), {"key": key}
        )
        context = AuthorizedContext(
            Principal(job.requested_by_user_id, "u@example.com", "U", False),
            AuthorizationScope(job.organization_id, job.workspace_id),
            frozenset(),
        )
        await lease.establish(context)
        running = replace(
            job,
            status=JobStatus.RUNNING,
            started_at=datetime.now(UTC),
            attempt_count=1,
        )
        await repository.replace_job(running)
        await repository.append_event(running, "job.running", {"attempt": 1})
        await session.commit()

        await _establish_application_tenant(application_connection, uuid4(), uuid4(), uuid4())
        assert (
            await application_connection.scalar(
                text("SELECT status FROM jobs WHERE id=:id"), {"id": job.id}
            )
            is None
        )
        assert (
            await application_connection.scalar(
                text("SELECT count(*) FROM job_events WHERE job_id=:id"), {"id": job.id}
            )
            == 0
        )
        await application_connection.rollback()
        assert await application_connection.scalar(
            text("SELECT NULLIF(current_setting('app.current_workspace_id', true), '') IS NULL")
        )
        await application_connection.rollback()

        await lease.establish(context)
        assert await session.scalar(text("SELECT current_setting('app.current_user_id')")) == str(
            job.requested_by_user_id
        )
        await _establish_application_tenant(
            application_connection,
            job.organization_id,
            job.workspace_id,
            job.requested_by_user_id,
        )
        assert (
            await application_connection.scalar(
                text("SELECT status FROM jobs WHERE id=:id"), {"id": job.id}
            )
            == "running"
        )
        assert (
            await application_connection.scalar(
                text("SELECT count(*) FROM job_events WHERE job_id=:id"), {"id": job.id}
            )
            == 1
        )
        await application_connection.commit()
        assert await application_connection.scalar(
            text("SELECT NULLIF(current_setting('app.current_workspace_id', true), '') IS NULL")
        )
        await application_connection.rollback()
        await _establish_application_tenant(
            application_connection,
            job.organization_id,
            job.workspace_id,
            job.requested_by_user_id,
        )
        await lease.__aexit__(None, None, None)
        lease_closed = True
        assert await lock_connection.scalar(
            text("SELECT pg_try_advisory_lock(hashtextextended(:key,0))"), {"key": key}
        )
        await lock_connection.execute(
            text("SELECT pg_advisory_unlock(hashtextextended(:key,0))"), {"key": key}
        )
        assert (
            await application_connection.scalar(
                text("SELECT status FROM jobs WHERE id=:id"), {"id": job.id}
            )
            == "running"
        )
        assert (
            await application_connection.scalar(
                text("SELECT count(*) FROM job_events WHERE job_id=:id"), {"id": job.id}
            )
            == 1
        )
    finally:
        if lease is not None and not lease_closed:
            await lease.__aexit__(None, None, None)
        await setup_session.close()
        await setup_connection.close()
        await lock_connection.close()
        await application_connection.close()
        await admin_engine.dispose()
        await worker_engine.dispose()
        await application_engine.dispose()
