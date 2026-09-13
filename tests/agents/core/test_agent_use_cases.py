from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.executions.agents.domain import (
    AgentDefinition,
    AgentRun,
    AgentVersion,
    RunStatus,
)
from agent_factory_core.executions.agents.use_cases import AgentUseCases
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal


class Clock:
    def now(self) -> datetime:
        return datetime(2026, 9, 13, tzinfo=UTC)


class Publisher:
    def __init__(self) -> None:
        self.staged: list[AgentRun] = []

    async def stage(self, run: AgentRun) -> object:
        self.staged.append(run)
        return {"run": run.id}

    def publish(self, job: object) -> str:
        return "published"

    async def record_publication(self, job: object, publication_id: str) -> None:
        pass


class Repository:
    def __init__(self, definition: AgentDefinition, version: AgentVersion, run: AgentRun) -> None:
        self.definition = definition
        self.version = version
        self.run = run
        self.inserted: list[AgentRun] = []
        self.events: list[tuple[AgentRun, str]] = []

    async def lock_workspace(self, organization_id, workspace_id):
        return True

    async def get_run(self, workspace_id, run_id, *, lock=False):
        return (
            self.run
            if run_id == self.run.id
            else next((row for row in self.inserted if row.id == run_id), None)
        )

    async def get_definition(self, workspace_id, definition_id, *, lock=False):
        return self.definition if definition_id == self.definition.id else None

    async def get_version(self, workspace_id, definition_id, version_id):
        return self.version if version_id == self.version.id else None

    async def insert_run(self, value):
        self.inserted.append(value)
        return value

    async def append_event(self, run, event_type, payload):
        self.events.append((run, event_type))
        return object()

    async def commit(self):
        pass

    async def rollback(self):
        pass

    async def soft_delete_definition(self, workspace_id, definition_id, expected_revision, now):
        return definition_id == self.definition.id and expected_revision == self.definition.revision

    async def list_events(self, workspace_id, run_id):
        return []

    async def list_tool_calls(self, workspace_id, run_id):
        return []

    async def list_artifacts(self, workspace_id, run_id):
        return []

    async def list_document_links(self, workspace_id, run_id):
        return []


@pytest.mark.asyncio
async def test_retry_preserves_original_link_and_stages_job_with_queued_event() -> None:
    user_id, organization_id, workspace_id = uuid4(), uuid4(), uuid4()
    definition = AgentDefinition(uuid4(), workspace_id, "A", "a", "")
    version = AgentVersion(
        uuid4(), workspace_id, definition.id, 1, "Do work", "model", {}, (), user_id
    )
    original = AgentRun(
        uuid4(),
        workspace_id,
        definition.id,
        version.id,
        user_id,
        "original",
        {"input": 1},
        RunStatus.FAILED,
    )
    repository = Repository(definition, version, original)
    publisher = Publisher()
    context = AuthorizedContext(
        Principal(user_id, "user@example.test", "User", False),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"agent.execute"}),
    )

    retry = await AgentUseCases(repository, Clock(), publisher).retry(context, original.id)

    assert retry.retry_of_run_id == original.id
    assert retry.version_id == original.version_id
    assert publisher.staged == [retry]
    assert repository.events == [(retry, "run.queued")]


@pytest.mark.asyncio
async def test_evidence_is_scoped_through_authorized_run_lookup() -> None:
    user_id, organization_id, workspace_id = uuid4(), uuid4(), uuid4()
    definition = AgentDefinition(uuid4(), workspace_id, "A", "a", "")
    version = AgentVersion(
        uuid4(), workspace_id, definition.id, 1, "Do work", "model", {}, (), user_id
    )
    run = AgentRun(uuid4(), workspace_id, definition.id, version.id, user_id, "key", {})
    repository = Repository(definition, version, run)
    context = AuthorizedContext(
        Principal(user_id, "user@example.test", "User", False),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"agent.read"}),
    )

    evidence = await AgentUseCases(repository, Clock()).evidence(context, run.id)

    assert evidence.run == run
    assert evidence.events == ()
    assert evidence.documents == ()


@pytest.mark.asyncio
async def test_delete_definition_uses_revision_aware_soft_delete() -> None:
    user_id, organization_id, workspace_id = uuid4(), uuid4(), uuid4()
    definition = AgentDefinition(uuid4(), workspace_id, "A", "a", "")
    version = AgentVersion(
        uuid4(), workspace_id, definition.id, 1, "Do work", "model", {}, (), user_id
    )
    run = AgentRun(uuid4(), workspace_id, definition.id, version.id, user_id, "key", {})
    repository = Repository(definition, version, run)
    context = AuthorizedContext(
        Principal(user_id, "user@example.test", "User", False),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"agent.delete"}),
    )

    await AgentUseCases(repository, Clock()).delete_definition(
        context, definition.id, expected_revision=definition.revision
    )
