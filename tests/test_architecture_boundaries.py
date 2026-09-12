"""Static guards for the modular-monolith adapter boundaries."""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTERS = ROOT / "app/router"
SQL_CONSTRUCTORS = {"delete", "insert", "select", "text", "update"}
SESSION_MUTATIONS = {
    "add",
    "commit",
    "delete",
    "execute",
    "flush",
    "refresh",
    "rollback",
    "scalar",
    "scalars",
}


def test_http_routers_do_not_own_persistence_or_transactions() -> None:
    violations: list[str] = []
    for path in sorted(ROUTERS.glob("*.py")):
        if path.name == "readiness.py":
            continue
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "sqlalchemy":
                imported = {alias.name for alias in node.names} & SQL_CONSTRUCTORS
                if imported:
                    violations.append(f"{path.name}:{node.lineno}: SQL import {sorted(imported)}")
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            owner = node.func.value
            if (
                isinstance(owner, ast.Name)
                and owner.id == "session"
                and node.func.attr in SESSION_MUTATIONS
            ):
                violations.append(f"{path.name}:{node.lineno}: session.{node.func.attr}()")
            if (
                isinstance(owner, ast.Attribute)
                and owner.attr == "session"
                and node.func.attr in SESSION_MUTATIONS
            ):
                violations.append(f"{path.name}:{node.lineno}: exposed session.{node.func.attr}()")
    assert not violations, "\n".join(violations)


def test_domain_modules_do_not_import_private_workspace_service_helpers() -> None:
    violations = []
    for path in sorted((ROOT / "app/modules").glob("**/*.py")):
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.ImportFrom):
                continue
            if node.module == "app.modules.workspace.service" and any(
                alias.name.startswith("_") for alias in node.names
            ):
                violations.append(f"{path.relative_to(ROOT)}:{node.lineno}")
    assert not violations, "\n".join(violations)


def test_http_routers_do_not_call_transaction_methods() -> None:
    violations = []
    for path in sorted(ROUTERS.glob("*.py")):
        if path.name == "readiness.py":
            continue
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr in {"commit", "rollback"}
            ):
                violations.append(f"{path.name}:{node.lineno}:{node.func.attr}")
    assert not violations, "\n".join(violations)


def test_http_and_mcp_share_agent_execution_composition() -> None:
    for path in (ROUTERS / "agents.py", ROOT / "app/mcp/server.py"):
        tree = ast.parse(path.read_text(), filename=str(path))
        imported = any(
            isinstance(node, ast.ImportFrom)
            and node.module == "app.modules.agent.factory"
            and any(alias.name == "agent_execution_service" for alias in node.names)
            for node in ast.walk(tree)
        )
        assert imported, f"{path.relative_to(ROOT)} bypasses shared Agent composition"


def _import_names(tree: ast.AST) -> list[tuple[int, str]]:
    imports: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend((node.lineno, alias.name) for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append((node.lineno, node.module))
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "importlib"
            and node.func.attr == "import_module"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            imports.append((node.lineno, node.args[0].value))
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "__import__"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            imports.append((node.lineno, node.args[0].value))
    return imports


def test_identity_package_dependency_directions_include_dynamic_imports() -> None:
    forbidden_core = (
        "app",
        "apps",
        "agent_factory_adapters",
        "fastapi",
        "sqlalchemy",
        "authlib",
        "pwdlib",
    )
    violations: list[str] = []
    core = ROOT / "packages/platform-core/src/agent_factory_core"
    adapters = ROOT / "packages/platform-adapters/src/agent_factory_adapters/identity"
    for path in sorted(core.rglob("*.py")):
        tree = ast.parse(path.read_text(), filename=str(path))
        for line, name in _import_names(tree):
            if name in forbidden_core or name.startswith(
                tuple(f"{prefix}." for prefix in forbidden_core)
            ):
                violations.append(f"{path.relative_to(ROOT)}:{line}: {name}")
    for path in sorted(adapters.rglob("*.py")):
        tree = ast.parse(path.read_text(), filename=str(path))
        for line, name in _import_names(tree):
            if (
                name == "app"
                or name.startswith("app.")
                or name == "apps"
                or name.startswith("apps.")
            ):
                violations.append(f"{path.relative_to(ROOT)}:{line}: {name}")
    assert not violations, "\n".join(violations)
