from pathlib import Path

import pytest


def test_rejects_forbidden_python_and_dynamic_typescript_imports(
    tmp_path: Path, monkeypatch
) -> None:
    core = tmp_path / "packages/platform-core/src/bad.py"
    runtime = tmp_path / "packages/workbench-runtime/src/bad.ts"
    core.parent.mkdir(parents=True)
    runtime.parent.mkdir(parents=True)
    core.write_text("from fastapi import FastAPI\n")
    runtime.write_text("const app = import('@agent-factory/web')\n")
    import tests.tools.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    findings = guard.violations([core, runtime])
    assert len(findings) == 2


def test_rejects_dotted_and_dynamic_legacy_imports_from_core_and_adapters(
    tmp_path: Path, monkeypatch
) -> None:
    core = tmp_path / "packages/platform-core/src/dynamic.py"
    adapter = tmp_path / "packages/platform-adapters/src/dotted.py"
    core.parent.mkdir(parents=True)
    adapter.parent.mkdir(parents=True)
    core.write_text(
        "import importlib\nmodel = importlib.import_module('app.modules.auth.models')\n"
    )
    adapter.write_text("from app.db.session import get_session\n")
    import tests.tools.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    findings = guard.violations([core, adapter])
    assert len(findings) == 2


def test_allows_core_contract_and_adapter_core_dependencies(tmp_path: Path, monkeypatch) -> None:
    core = tmp_path / "packages/platform-core/src/good.py"
    adapter = tmp_path / "packages/platform-adapters/src/good.py"
    core.parent.mkdir(parents=True)
    adapter.parent.mkdir(parents=True)
    core.write_text("from agent_factory_contracts import validate\n")
    adapter.write_text("from agent_factory_core import GetReferenceWorkbench\n")
    import tests.tools.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    assert guard.violations([core, adapter]) == []


def test_rejects_forbidden_python_and_typescript_manifest_dependencies(
    tmp_path: Path, monkeypatch
) -> None:
    core = tmp_path / "packages/platform-core/pyproject.toml"
    contracts = tmp_path / "packages/contracts-ts/package.json"
    core.parent.mkdir(parents=True)
    contracts.parent.mkdir(parents=True)
    core.write_text('[project]\nname="bad-core"\nversion="0.1.0"\ndependencies=["fastapi"]\n')
    contracts.write_text(
        '{"name":"bad-contracts","dependencies":{"@agent-factory/workbench-runtime":"workspace:*"}}'
    )
    import tests.tools.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    findings = guard.violations([core, contracts])
    assert len(findings) == 2


def test_allows_declared_dependencies_in_both_manifests(tmp_path: Path, monkeypatch) -> None:
    core = tmp_path / "packages/platform-core/pyproject.toml"
    runtime = tmp_path / "packages/workbench-runtime/package.json"
    core.parent.mkdir(parents=True)
    runtime.parent.mkdir(parents=True)
    core.write_text(
        '[project]\nname="good-core"\nversion="0.1.0"\ndependencies=["agent-factory-contracts"]\n'
    )
    runtime.write_text(
        '{"name":"good-runtime","dependencies":{"@agent-factory/contracts":"workspace:*",'
        '"@agent-factory/design-system":"workspace:*"}}'
    )
    import tests.tools.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    assert guard.violations([core, runtime]) == []


@pytest.mark.parametrize(
    ("source", "statement", "reason"),
    [
        (
            "shell/WorkbenchShell.tsx",
            "import { client } from '../standard/documents/document-client.js'",
            "bypasses the public index",
        ),
        (
            "standard/account/AccountWorkbench.tsx",
            "export { client } from '../workspace/workspace-client.js'",
            "bypasses the public index",
        ),
        (
            "standard/documents/DocumentsWorkbench.tsx",
            "import { organizationClient } from '../organization'",
            "bypasses the public index",
        ),
        (
            "standard/documents/DocumentsWorkbench.tsx",
            "const organization = import('../organization/index.js')",
            "undeclared feature dependency documents -> organization",
        ),
        (
            "standard/connections/WorkspaceConnections.tsx",
            "import type { WorkspaceRecord } from '../workspace/index.js'",
            "undeclared feature dependency connections -> workspace",
        ),
        (
            "standard/account/AccountWorkbench.tsx",
            "import type { User } from '../../app/WorkbenchContext.js'",
            "depends on application composition",
        ),
    ],
)
def test_rejects_web_feature_boundary_violations(
    tmp_path: Path, monkeypatch, source, statement, reason
) -> None:
    import tests.tools.check_workbench_dependencies as guard

    path = tmp_path / "apps/web/src" / source
    path.parent.mkdir(parents=True)
    path.write_text(statement)
    monkeypatch.setattr(guard, "ROOT", tmp_path)
    findings = guard.violations([path])
    assert len(findings) == 1
    assert reason in findings[0]


@pytest.mark.parametrize(
    ("source", "statement"),
    [
        (
            "shell/WorkbenchShell.tsx",
            "import { DocumentsWorkbench } from '../standard/documents/index.js'",
        ),
        (
            "app/workbench-bindings.ts",
            "import { createDocumentBindingClient } from '../standard/documents/index.js'",
        ),
        (
            "standard/workspace/WorkspaceWorkbench.tsx",
            "import { WorkspaceConnections } from '../connections/index.js'",
        ),
        (
            "standard/account/AccountWorkbench.tsx",
            "import { workspaceClient } from '../workspace/index.js'",
        ),
        (
            "standard/documents/document-bindings.ts",
            "import { documentClient } from './document-client.js'",
        ),
        ("standard/account/account-client.ts", "import { apiRequest } from '../../api-client.js'"),
    ],
)
def test_allows_web_public_composition_and_local_implementation(
    tmp_path: Path, monkeypatch, source, statement
) -> None:
    import tests.tools.check_workbench_dependencies as guard

    path = tmp_path / "apps/web/src" / source
    path.parent.mkdir(parents=True)
    path.write_text(statement)
    monkeypatch.setattr(guard, "ROOT", tmp_path)
    assert guard.violations([path]) == []


def test_current_web_source_respects_feature_boundaries() -> None:
    import tests.tools.check_workbench_dependencies as guard

    paths = [
        path for path in (guard.ROOT / "apps/web/src").rglob("*") if path.suffix in {".ts", ".tsx"}
    ]
    assert guard.violations(paths) == []


def test_rejects_api_worker_imports_and_manifest_dependencies(tmp_path: Path, monkeypatch) -> None:
    api = tmp_path / "apps/api/bad.py"
    worker = tmp_path / "apps/worker/pyproject.toml"
    api.parent.mkdir(parents=True)
    worker.parent.mkdir(parents=True)
    api.write_text("from agent_factory_worker.celery_app import celery_app\n")
    worker.write_text('[project]\ndependencies=["agent-factory-api"]\n')
    import tests.tools.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    assert len(guard.violations([api, worker])) == 2
