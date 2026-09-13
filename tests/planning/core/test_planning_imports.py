from uuid import uuid4

import pytest
from agent_factory_core.executions.planning.imports import ImportPreview, PlanningImports
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ConflictError


class Repository:
    def __init__(self):
        self.record = None
        self.baseline = "baseline-1"
        self.commits = 0
        self.rollbacks = 0
        self.failure: BaseException | None = None

    async def by_request_key(self, workspace_id, request_key):
        return self.record

    async def get_preview(self, workspace_id, import_id):
        return self.record

    async def planning_snapshot_digest(self, workspace_id):
        return self.baseline

    async def create_preview(self, workspace_id, request_key, proposal, proposal_digest, baseline):
        self.record = ImportPreview(
            uuid4(),
            workspace_id,
            request_key,
            proposal,
            {"warnings": ["review"]},
            baseline,
            proposal_digest,
        )
        return self.record

    async def apply_preview(self, preview):
        if self.failure:
            raise self.failure
        return {"created": 1}

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def context() -> AuthorizedContext:
    return AuthorizedContext(
        Principal(uuid4(), "user@example.com", "User", False),
        AuthorizationScope(uuid4(), uuid4()),
        frozenset({"planning.import"}),
    )


@pytest.mark.asyncio
async def test_import_preview_is_idempotent_and_apply_checks_warning_and_snapshot() -> None:
    repository = Repository()
    service = PlanningImports(repository)
    proposal = {"request_key": "import-1", "items": [{"source_id": "A"}]}
    preview = await service.preview(context(), proposal)
    assert await service.preview(context(), proposal) == preview
    with pytest.raises(ConflictError, match="warnings"):
        await service.apply(context(), preview.id, preview.digest, acknowledge_warnings=False)
    repository.baseline = "changed"
    with pytest.raises(ConflictError, match="changed"):
        await service.apply(context(), preview.id, preview.digest, acknowledge_warnings=True)


@pytest.mark.asyncio
async def test_apply_success_replay_digest_and_adapter_rollback() -> None:
    repository = Repository()
    service = PlanningImports(repository)
    preview = await service.preview(context(), {"request_key": "import-2", "items": []})
    repository.record = ImportPreview(
        preview.id,
        preview.workspace_id,
        preview.request_key,
        preview.proposal,
        {"warnings": []},
        preview.baseline,
        preview.digest,
    )
    assert await service.apply(
        context(), preview.id, preview.digest, acknowledge_warnings=False
    ) == {"created": 1}
    repository.record = ImportPreview(
        preview.id,
        preview.workspace_id,
        preview.request_key,
        preview.proposal,
        {},
        preview.baseline,
        preview.digest,
        {"created": 1},
    )
    assert await service.apply(
        context(), preview.id, preview.digest, acknowledge_warnings=False
    ) == {"created": 1}
    with pytest.raises(ConflictError, match="digest"):
        await service.apply(context(), preview.id, "wrong", acknowledge_warnings=False)
    repository.record = ImportPreview(
        preview.id,
        preview.workspace_id,
        preview.request_key,
        preview.proposal,
        {},
        preview.baseline,
        preview.digest,
    )
    repository.failure = RuntimeError("adapter failed")
    with pytest.raises(RuntimeError, match="adapter failed"):
        await service.apply(context(), preview.id, preview.digest, acknowledge_warnings=False)
    assert repository.rollbacks == 1


@pytest.mark.asyncio
async def test_concurrent_identical_request_key_returns_winning_preview() -> None:
    class ConcurrentRepository(Repository):
        async def create_preview(
            self, workspace_id, request_key, proposal, proposal_digest, baseline
        ):
            self.record = ImportPreview(
                uuid4(), workspace_id, request_key, proposal, {}, baseline, proposal_digest
            )
            raise ConflictError("request_key_conflict", "concurrent insert")

    repository = ConcurrentRepository()
    result = await PlanningImports(repository).preview(
        context(), {"request_key": "same", "items": []}
    )
    assert result == repository.record
    assert repository.rollbacks == 1


@pytest.mark.asyncio
async def test_concurrent_apply_replay_returns_result_after_waiting_for_workspace_lock() -> None:
    class ConcurrentApplyRepository(Repository):
        async def planning_snapshot_digest(self, workspace_id):
            digest = await super().planning_snapshot_digest(workspace_id)
            if self.record is not None and self.record.result is None:
                self.record = ImportPreview(
                    self.record.id,
                    self.record.workspace_id,
                    self.record.request_key,
                    self.record.proposal,
                    self.record.preview,
                    self.record.baseline,
                    self.record.digest,
                    {"created": 1},
                )
                self.baseline = "changed-by-winning-apply"
            return self.baseline if digest == "baseline-1" else digest

    repository = ConcurrentApplyRepository()
    service = PlanningImports(repository)
    preview = await service.preview(context(), {"request_key": "apply-race", "items": []})
    assert await service.apply(
        context(), preview.id, preview.digest, acknowledge_warnings=True
    ) == {"created": 1}
