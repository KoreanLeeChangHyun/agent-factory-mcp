from pathlib import Path


def test_rejects_forbidden_python_and_dynamic_typescript_imports(
    tmp_path: Path, monkeypatch
) -> None:
    core = tmp_path / "packages/platform-core/src/bad.py"
    runtime = tmp_path / "packages/workbench-runtime/src/bad.ts"
    core.parent.mkdir(parents=True)
    runtime.parent.mkdir(parents=True)
    core.write_text("from fastapi import FastAPI\n")
    runtime.write_text("const app = import('@agent-factory/web')\n")
    import scripts.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    findings = guard.violations([core, runtime])
    assert len(findings) == 2


def test_allows_core_contract_and_adapter_core_dependencies(tmp_path: Path, monkeypatch) -> None:
    core = tmp_path / "packages/platform-core/src/good.py"
    adapter = tmp_path / "packages/platform-adapters/src/good.py"
    core.parent.mkdir(parents=True)
    adapter.parent.mkdir(parents=True)
    core.write_text("from agent_factory_contracts import validate\n")
    adapter.write_text("from agent_factory_core import GetReferenceWorkbench\n")
    import scripts.check_workbench_dependencies as guard

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
    import scripts.check_workbench_dependencies as guard

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
    import scripts.check_workbench_dependencies as guard

    monkeypatch.setattr(guard, "ROOT", tmp_path)
    assert guard.violations([core, runtime]) == []
