from __future__ import annotations

from types import TracebackType
from typing import Self
from uuid import UUID

from agent_factory_core.executions.scheduling.domain import Job
from agent_factory_core.identity.authorization import AuthorizedContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession

from .repository import PostgresSchedulingRepository


class PostgresExecutionLease:
    """A session-level advisory claim pinned to one checked-out connection."""

    def __init__(
        self,
        connection: AsyncConnection,
        session: AsyncSession,
        repository: PostgresSchedulingRepository,
        job: Job,
    ) -> None:
        self.connection = connection
        self.session = session
        self.repository = repository
        self.job = job

    async def establish(self, context: AuthorizedContext) -> None:
        if context.scope.workspace_id != self.job.workspace_id:
            raise ValueError("reauthorized context does not match durable job workspace")
        await self.session.execute(
            text(
                "SELECT set_config('app.current_organization_id', :oid, true), "
                "set_config('app.current_workspace_id', :wid, true), "
                "set_config('app.current_user_id', :uid, true), "
                "set_config('app.is_platform_admin', :admin, true)"
            ),
            {
                "oid": str(context.scope.organization_id),
                "wid": str(context.scope.workspace_id),
                "uid": str(context.principal.user_id),
                "admin": "true" if context.principal.is_platform_admin else "false",
            },
        )

    async def establish_durable_identity(self) -> None:
        await self.session.execute(
            text(
                "SELECT set_config('app.current_organization_id', :oid, true), "
                "set_config('app.current_workspace_id', :wid, true), "
                "set_config('app.current_user_id', :uid, true), "
                "set_config('app.is_platform_admin', 'false', true)"
            ),
            {
                "oid": str(self.job.organization_id),
                "wid": str(self.job.workspace_id),
                "uid": str(self.job.requested_by_user_id),
            },
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        try:
            await self.session.rollback()
            await self.connection.execute(
                text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"),
                {"key": f"agent-factory-job:{self.job.id}"},
            )
            await self.connection.commit()
        finally:
            await self.session.close()
            await self.connection.close()


class PostgresExecutionLeaseFactory:
    def __init__(self, engine: AsyncEngine) -> None:
        self.engine = engine

    async def acquire(self, job_id: UUID) -> PostgresExecutionLease | None:
        connection = await self.engine.connect()
        locked = await connection.scalar(
            text("SELECT pg_try_advisory_lock(hashtextextended(:key, 0))"),
            {"key": f"agent-factory-job:{job_id}"},
        )
        if not locked:
            await connection.close()
            return None
        # The advisory lock is session-scoped and survives commit. End the
        # implicit SELECT transaction so the bound Session owns later commits.
        await connection.commit()
        session = AsyncSession(bind=connection, expire_on_commit=False)
        repository = PostgresSchedulingRepository(session)
        job = await repository.control_plane_job(job_id)
        if job is None:
            await session.rollback()
            await connection.execute(
                text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"),
                {"key": f"agent-factory-job:{job_id}"},
            )
            await connection.commit()
            await session.close()
            await connection.close()
            return None
        return PostgresExecutionLease(connection, session, repository, job)
