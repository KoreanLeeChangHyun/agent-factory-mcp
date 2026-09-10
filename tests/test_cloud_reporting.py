"""Isolated cloud reporting contracts; no shared database or provider access."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine

import app.db.models  # noqa: F401 -- register existing ORM relationships
from app.common.errors import ConflictError, PermissionDeniedError
from app.modules.planning.repository import PlanningRepository
from app.modules.reporting.models import ReportAgent, ReportReceipt, ReportTask, TaskReport
from app.modules.reporting.schemas import Command, RuntimeBinding, SearchQuery
from app.modules.reporting.search import search_reports, search_statement
from app.modules.reporting.service import ReportingService, command_digest, require_binding
from app.modules.workspace.models import WorkspaceStatus
from tests.support.mcp import McpServerStub

BINDING = {
    "project_ref": "project_123",
    "agent_id": "work-123",
    "session_id": "session-123",
    "run_id": "run-123",
    "loop_id": "loop-123",
}


@pytest.mark.parametrize("field", list(BINDING))
@pytest.mark.parametrize(
    "value", ["../secret", "/tmp/run", "https://host/path", "a:b", "a\nb", "x" * 161]
)
def test_binding_rejects_paths_and_unbounded_identifiers(field, value):
    with pytest.raises(ValidationError):
        RuntimeBinding(**{**BINDING, field: value})


def test_binding_closed_and_immutable_including_unbound_tasks():
    with pytest.raises(ValidationError):
        RuntimeBinding(**BINDING, token="secret")
    binding = RuntimeBinding(**BINDING)
    task = SimpleNamespace(runtime_binding=binding.model_dump(mode="json"))
    require_binding(task, binding)
    for other in (None, RuntimeBinding(**{**BINDING, "run_id": "run-other"})):
        with pytest.raises(ConflictError):
            require_binding(task, other)
    with pytest.raises(ConflictError):
        require_binding(SimpleNamespace(runtime_binding=None), binding)


@pytest.mark.parametrize("query", ["", "   ", "x" * 257, "x\x00y", "x\u200by"])
def test_query_bounds(query):
    with pytest.raises(ValidationError):
        SearchQuery(query=query, kind="task")


@pytest.mark.parametrize("limit", [0, 101, True, 1.5])
def test_page_bounds(limit):
    with pytest.raises(ValidationError):
        SearchQuery(query="검색", kind="task", limit=limit)


@pytest.mark.parametrize(
    "kind,table,title,body,extras",
    [
        ("agent", "report_agents", "name", "responsibilities", "role TEXT, parent_id TEXT"),
        (
            "task",
            "report_tasks",
            "name",
            "description",
            "agent_id TEXT, parent_id TEXT, runtime_binding JSON",
        ),
        ("report", "task_reports", "status", "message", "task_id TEXT"),
        (
            "result",
            "report_results",
            "label",
            "summary",
            "report_id TEXT, document_id TEXT, url TEXT",
        ),
    ],
)
def test_literal_retrieval_workspace_isolation_and_keyset(kind, table, title, body, extras):
    # Execute the real query against private, disposable SQLite tables.
    engine = create_engine("sqlite:///:memory:")
    workspace, foreign = uuid4(), uuid4()
    with engine.begin() as conn:
        conn.exec_driver_sql(
            f"CREATE TABLE {table} (id TEXT, workspace_id TEXT, {title} TEXT, {body} TEXT, {extras})"
        )
        for identity, scope, text in [
            (1, workspace, "한국어 검색 run-123_a 100% /"),
            (2, workspace, "한국어 검색 run-123_a 100% /"),
            (3, foreign, "한국어 검색 run-123_a 100% /"),
            (4, workspace, "run-123Xa 1000 OR unrelated"),
        ]:
            conn.exec_driver_sql(
                f"INSERT INTO {table} (id,workspace_id,{title},{body}) VALUES (?,?,?,?)",
                (UUID(int=identity).hex, scope.hex, "entry", text),
            )
        for query in ("한국어", "검색", "run-123_a", "100%", "/"):
            rows = conn.execute(
                search_statement(workspace, SearchQuery(query=query, kind=kind, limit=1))
            ).all()
            assert [row.id for row in rows] == [UUID(int=1), UUID(int=2)]
            rows = conn.execute(
                search_statement(
                    workspace, SearchQuery(query=query, kind=kind, after_id=UUID(int=1))
                )
            ).all()
            assert [row.id for row in rows] == [UUID(int=2)]
        assert not conn.execute(
            search_statement(workspace, SearchQuery(query='" OR *', kind=kind))
        ).all()
    engine.dispose()


@pytest.mark.asyncio
async def test_search_requires_permission_before_query():
    session = SimpleNamespace(execute=AsyncMock())
    with pytest.raises(PermissionDeniedError):
        await search_reports(
            session, SimpleNamespace(permissions=set()), SearchQuery(query="x", kind="agent")
        )
    session.execute.assert_not_called()


def test_legacy_receipt_hash_remains_identical():
    command = Command(
        key="legacy",
        operation="report",
        report={"id": uuid4(), "revision": 1, "status": "in_progress", "message": "작업"},
    )
    old = command.model_dump(mode="json")
    old.pop("heartbeat")
    old["report"].pop("runtime_binding")
    expected = hashlib.sha256(
        json.dumps(old, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert command_digest(command) == expected


@pytest.fixture
def reporting_harness(monkeypatch):
    """Exercise service ordering with a simulated workspace lock, not PostgreSQL RLS."""
    context = SimpleNamespace(
        scope=SimpleNamespace(workspace_id=uuid4(), organization_id=uuid4()),
        principal=SimpleNamespace(user_id=uuid4()),
        permissions={"agent.report", "agent.read"},
    )
    now = datetime.now(UTC)
    agent = ReportAgent(
        id=uuid4(),
        workspace_id=context.scope.workspace_id,
        owner_user_id=context.principal.user_id,
        revision=1,
    )
    task = ReportTask(
        id=uuid4(),
        workspace_id=context.scope.workspace_id,
        agent_id=agent.id,
        name="task",
        description="",
        revision=1,
        status="pending",
        runtime_binding=BINDING.copy(),
        created_at=now,
        updated_at=now,
    )
    receipts, reports = {}, []
    lock = asyncio.Lock()

    async def acquire(*args):
        await lock.acquire()

    monkeypatch.setattr(PlanningRepository, "lock", acquire)

    async def submit(command, connection_id=None):
        pending = []

        async def scalar(statement):
            return receipts.get(statement.compile().params["key_1"])

        async def commit():
            for row in pending:
                if isinstance(row, ReportReceipt):
                    receipts[row.key] = row
                elif isinstance(row, TaskReport):
                    reports.append(row)

        session = SimpleNamespace(
            scalar=scalar,
            get=AsyncMock(return_value=SimpleNamespace(status=WorkspaceStatus.ACTIVE)),
            add=pending.append,
            flush=AsyncMock(),
            refresh=AsyncMock(),
            commit=commit,
            rollback=AsyncMock(),
        )
        service = ReportingService(session, context)

        async def get(model, identity):
            return task if model is ReportTask else agent

        service.get = get
        try:
            return await service.command(command, connection_id)
        finally:
            if lock.locked():
                lock.release()

    return task, agent, reports, submit


def report_command(task, key="report", **changes):
    payload = {
        "id": task.id,
        "revision": 1,
        "status": "in_progress",
        "message": "작업",
        "runtime_binding": BINDING,
    }
    payload.update(changes)
    return Command(key=key, operation="report", report=payload)


@pytest.mark.asyncio
async def test_identical_concurrent_retry_reconnect_and_revision_conflict(reporting_harness):
    task, _agent, reports, submit = reporting_harness
    command = report_command(task)
    first, retry = await asyncio.gather(submit(command, uuid4()), submit(command, uuid4()))
    assert first == retry and task.revision == 2 and len(reports) == 1
    assert first["record"]["runtime_binding"] == BINDING
    with pytest.raises(ConflictError) as error:
        await submit(report_command(task, message="changed"))
    assert error.value.code == "report_idempotency_conflict"
    with pytest.raises(ConflictError) as error:
        await submit(report_command(task, key="other"))
    assert error.value.code == "report_revision_conflict"


@pytest.mark.asyncio
async def test_competing_new_commands_have_one_revision_winner(reporting_harness):
    task, _agent, reports, submit = reporting_harness
    outcomes = await asyncio.gather(
        submit(report_command(task, "a")), submit(report_command(task, "b")), return_exceptions=True
    )
    assert sum(isinstance(result, ConflictError) for result in outcomes) == 1
    assert task.revision == 2 and len(reports) == 1


@pytest.mark.asyncio
async def test_binding_mismatch_and_missing_binding_rejected_before_mutation(reporting_harness):
    task, _agent, reports, submit = reporting_harness
    for binding in (None, {**BINDING, "session_id": "other"}):
        with pytest.raises(ConflictError) as error:
            await submit(report_command(task, runtime_binding=binding))
        assert error.value.code == "report_runtime_binding_conflict"
    assert task.revision == 1 and not reports


@pytest.mark.asyncio
async def test_heartbeats_are_observations_and_terminal_reports_stay_immutable(reporting_harness):
    task, agent, reports, submit = reporting_harness
    await submit(report_command(task))
    await submit(report_command(task, "finish", revision=2, status="completed"))
    before = (
        task.status,
        task.revision,
        task.progress,
        task.last_report_at,
        task.finished_at,
        agent.last_report_at,
        len(reports),
    )
    heartbeat = Command(
        key="hb",
        operation="heartbeat",
        heartbeat={
            "id": task.id,
            "runtime_binding": BINDING,
            "sequence": 1,
            "observed_at": datetime.now(UTC) - timedelta(seconds=10),
            "fact": "unreachable",
        },
    )
    assert await submit(heartbeat) == await submit(heartbeat)
    assert before == (
        task.status,
        task.revision,
        task.progress,
        task.last_report_at,
        task.finished_at,
        agent.last_report_at,
        len(reports),
    )
    with pytest.raises(ConflictError):
        await submit(heartbeat.model_copy(update={"key": "old-sequence"}))
    with pytest.raises(ConflictError):
        await submit(report_command(task, "late", revision=3))


@pytest.mark.asyncio
async def test_mcp_search_authorizes_exact_workspace_before_persistence():
    from app.mcp.reporting import install_reporting

    server = McpServerStub()
    authorize = AsyncMock(side_effect=PermissionDeniedError("permission_required"))
    install_reporting(server, authorize)
    result = await server.tools["reporting_search"](
        SearchQuery(query="한국어", kind="task"), "organization", "foreign-workspace"
    )
    authorize.assert_awaited_once_with(
        "organization", "foreign-workspace", "agent:read", "agent.read"
    )
    assert result.is_error


def test_packaged_cloud_guide_matches_document():
    from pathlib import Path

    from app.modules.reporting.guide import CLOUD_REPORTING_GUIDE

    document = (
        Path(__file__).resolve().parents[1]
        / ".codex/skills/spec-platform/references/cloud-reporting.md"
    )
    assert CLOUD_REPORTING_GUIDE == document.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_cloud_guide_resource_without_installed_docs(monkeypatch, tmp_path):
    from pathlib import Path

    import app.mcp.reporting as adapter
    from app.modules.reporting.guide import CLOUD_REPORTING_GUIDE

    def forbidden_read(*args, **kwargs):
        raise AssertionError("Cloud guide must not read a filesystem document")

    monkeypatch.setattr(adapter, "GUIDE", tmp_path / "absent-docs" / "external-agent-reporting.md")
    monkeypatch.setattr(Path, "read_text", forbidden_read)
    authorize = AsyncMock()
    server = McpServerStub()
    adapter.install_reporting(server, authorize)
    content = await server.resources["agent-factory://reporting/cloud-guide"]()
    assert content == CLOUD_REPORTING_GUIDE
    assert "reporting_search" in content and "Runtime association" in content
    authorize.assert_not_awaited()
