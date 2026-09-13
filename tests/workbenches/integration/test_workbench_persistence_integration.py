"""Disposable PostgreSQL coverage for Workbench transactional guarantees."""

import asyncio
import os
from copy import deepcopy
from uuid import uuid4

import pytest
from agent_factory_adapters import ContractWorkbenchValidator, PostgresWorkbenchRepository
from api.composition.workbenches import build_workbench_service
from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE
from agent_factory_core import (
    CreateWorkbenchDefinition,
    PublishWorkbenchDefinition,
    WorkbenchActor,
    WorkbenchConflictError,
    WorkbenchIdempotencyError,
    WorkbenchNotFoundError,
)
from sqlalchemy import text

from app.core.config import settings
from app.db.session import dispose_engine, get_session_factory
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.workspace.schemas import WorkspaceCreate
from app.router.account import create_personal_workspace


PERMISSIONS = frozenset(
    {
        "workbench.read",
        "workbench.preview",
        "workbench.create",
        "workbench.update",
        "workbench.publish",
    }
)


def _definition(key: str):
    definition = deepcopy(DOCUMENTS_FIXTURE)
    descriptor = definition["descriptor"]
    assert isinstance(descriptor, dict)
    descriptor["id"] = key
    return definition


async def _workspace(sessions, label: str):
    principal = Principal(uuid4(), f"{uuid4().hex}@example.test", label, False)
    async with sessions() as session:
        await AuthRepository(session)._enable_identity_lookup()
        session.add(User(id=principal.user_id, email=principal.email, display_name=label))
        await session.commit()
    async with sessions() as session:
        workspace = await create_personal_workspace(
            WorkspaceCreate(name=label, slug=uuid4().hex), principal, session
        )
    return principal, workspace


@pytest.mark.integration
@pytest.mark.asyncio
async def test_workbench_postgres_concurrency_rls_idempotency_and_immutability(monkeypatch):
    database_url = os.environ.get("WORKBENCH_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("requires a disposable migrated WORKBENCH_TEST_DATABASE_URL")
    await dispose_engine()
    monkeypatch.setattr(settings, "database_url", database_url)
    sessions = get_session_factory()
    first_principal, first_workspace = await _workspace(sessions, "Workbench A")
    second_principal, second_workspace = await _workspace(sessions, "Workbench B")
    first_actor = WorkbenchActor(
        first_principal.user_id,
        first_workspace.organization_id,
        first_workspace.id,
        PERMISSIONS,
    )
    second_actor = WorkbenchActor(
        second_principal.user_id,
        second_workspace.organization_id,
        second_workspace.id,
        PERMISSIONS,
    )

    async def create_same_key():
        async with sessions() as session:
            return await build_workbench_service(session).create.execute(
                first_actor,
                key="concurrent-create",
                title="Concurrent create",
                definition=_definition("concurrent-create"),
            )

    created = await asyncio.gather(create_same_key(), create_same_key(), return_exceptions=True)
    assert sum(not isinstance(item, Exception) for item in created) == 1
    assert sum(isinstance(item, WorkbenchConflictError) for item in created) == 1
    definition = next(item for item in created if not isinstance(item, Exception))

    async with sessions() as session:
        service = build_workbench_service(session)
        with pytest.raises(WorkbenchConflictError):
            await service.update.execute(
                first_actor,
                definition.id,
                title="Stale",
                definition=_definition("concurrent-create"),
                expected_revision=definition.revision + 1,
            )
        release = await service.publish.execute(
            first_actor,
            definition.id,
            expected_revision=definition.revision,
            request_key="publish-replay",
        )
    async with sessions() as session:
        replay = await build_workbench_service(session).publish.execute(
            first_actor,
            definition.id,
            expected_revision=definition.revision,
            request_key="publish-replay",
        )
        assert replay.id == release.id
        assert dict(replay.snapshot) == _definition("concurrent-create")
        assert replay.definition_digest == release.definition_digest
    async with sessions() as session:
        with pytest.raises(WorkbenchIdempotencyError):
            await build_workbench_service(session).publish.execute(
                first_actor,
                definition.id,
                expected_revision=definition.revision + 1,
                request_key="publish-replay",
            )
    async with sessions() as session:
        with pytest.raises(WorkbenchNotFoundError):
            await build_workbench_service(session).get_release.execute(second_actor, release.id)
    async with sessions() as session:
        assert (
            await session.execute(
                text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user")
            )
        ).one() == (False, False)
        assert (
            await session.execute(
                text(
                    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class "
                    "WHERE oid='workbench_releases'::regclass"
                )
            )
        ).one() == (True, True)
        await PostgresWorkbenchRepository(session)._scope(second_actor)
        assert (
            await session.scalar(
                text("SELECT id FROM workbench_releases WHERE id=:id"), {"id": release.id}
            )
            is None
        )

    async with sessions() as session:
        await PostgresWorkbenchRepository(session)._scope(first_actor)
        with pytest.raises(Exception, match="(?i)immutable"):
            await session.execute(
                text("UPDATE workbench_releases SET release_number=99 WHERE id=:id"),
                {"id": release.id},
            )
        await session.rollback()
        await PostgresWorkbenchRepository(session)._scope(first_actor)
        with pytest.raises(Exception, match="(?i)immutable"):
            await session.execute(
                text("DELETE FROM workbench_releases WHERE id=:id"), {"id": release.id}
            )
        await session.rollback()

    async with sessions() as session:
        rollback_candidate = await build_workbench_service(session).create.execute(
            first_actor,
            key="publication-rollback",
            title="Publication rollback",
            definition=_definition("publication-rollback"),
        )

    class PublicationAuditFailureRepository(PostgresWorkbenchRepository):
        async def _audit(self, *_args, **_kwargs):
            raise RuntimeError("forced publication audit failure")

    async with sessions() as session:
        command = PublishWorkbenchDefinition(
            PublicationAuditFailureRepository(session), ContractWorkbenchValidator()
        )
        with pytest.raises(RuntimeError, match="forced publication audit failure"):
            await command.execute(
                first_actor,
                rollback_candidate.id,
                expected_revision=rollback_candidate.revision,
                request_key="publication-rollback",
            )
        await session.rollback()
        await PostgresWorkbenchRepository(session)._scope(first_actor)
        state = (
            await session.execute(
                text(
                    "SELECT "
                    "(SELECT count(*) FROM workbench_releases WHERE definition_id=:definition_id), "
                    "(SELECT count(*) FROM workbench_publish_receipts WHERE request_key=:request_key), "
                    "(SELECT latest_release_id FROM workbench_definitions WHERE id=:definition_id), "
                    "(SELECT count(*) FROM audit_events WHERE action='workbench.release.publish' "
                    "AND event_metadata->>'definitionId'=:definition_id_text)"
                ),
                {
                    "definition_id": rollback_candidate.id,
                    "definition_id_text": str(rollback_candidate.id),
                    "request_key": "publication-rollback",
                },
            )
        ).one()
        assert state == (0, 0, None, 0)

    async with sessions() as session:
        candidate = await build_workbench_service(session).create.execute(
            first_actor,
            key="concurrent-publish",
            title="Concurrent publish",
            definition=_definition("concurrent-publish"),
        )

    async def publish(request_key: str):
        async with sessions() as session:
            return await build_workbench_service(session).publish.execute(
                first_actor,
                candidate.id,
                expected_revision=candidate.revision,
                request_key=request_key,
            )

    published = await asyncio.gather(
        publish("publish-a"), publish("publish-b"), return_exceptions=True
    )
    assert sum(not isinstance(item, Exception) for item in published) == 1
    assert sum(isinstance(item, WorkbenchConflictError) for item in published) == 1

    class AuditFailureRepository(PostgresWorkbenchRepository):
        async def _audit(self, *_args, **_kwargs):
            raise RuntimeError("forced audit failure")

    async with sessions() as session:
        command = CreateWorkbenchDefinition(
            AuditFailureRepository(session), ContractWorkbenchValidator()
        )
        with pytest.raises(RuntimeError, match="forced audit failure"):
            await command.execute(
                first_actor,
                key="audit-rollback",
                title="Audit rollback",
                definition=_definition("audit-rollback"),
            )
        await session.rollback()
        await PostgresWorkbenchRepository(session)._scope(first_actor)
        count = await session.scalar(
            text(
                "SELECT count(*) FROM workbench_definitions "
                "WHERE workspace_id=:workspace_id AND definition_key='audit-rollback'"
            ),
            {"workspace_id": first_actor.workspace_id},
        )
        assert count == 0
