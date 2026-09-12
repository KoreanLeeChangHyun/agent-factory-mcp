"""Enforce Stage-1 Python and TypeScript package dependency directions."""

from __future__ import annotations

import argparse
import ast
import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT_RE = re.compile(
    r"(?:import\s+(?:[^'\"]+?\s+from\s+)?|export\s+[^'\"]*?\s+from\s+|require\s*\(|import\s*\()\s*['\"]([^'\"]+)['\"]"
)
FORBIDDEN_CORE = {
    "fastapi",
    "sqlalchemy",
    "redis",
    "celery",
    "mcp",
    "boto3",
    "httpx",
    "openai",
    "anthropic",
}
PYTHON_INTERNAL = {
    "agent-factory-contracts": "contracts",
    "agent-factory-core": "core",
    "agent-factory-adapters": "adapters",
    "agent-factory-api": "app",
    "agent-factory-worker": "app",
}
PYTHON_IMPORTS = {name.replace("-", "_"): target for name, target in PYTHON_INTERNAL.items()}
TYPESCRIPT_INTERNAL = {
    "@agent-factory/contracts": "contracts",
    "@agent-factory/design-system": "design-system",
    "@agent-factory/workbench-runtime": "runtime",
    "@agent-factory/web": "app",
}
ALLOWED_TARGETS = {
    "contracts": set(),
    "core": {"contracts"},
    "adapters": {"contracts", "core"},
    "design-system": {"contracts"},
    "runtime": {"contracts", "design-system"},
    "app": {"contracts", "core", "adapters", "design-system", "runtime"},
}


def owner(path: Path) -> str | None:
    try:
        relative = path.resolve().relative_to(ROOT)
    except ValueError:
        return None
    parts = relative.parts
    if parts[:2] == ("packages", "platform-core"):
        return "core"
    if parts[:2] == ("packages", "platform-adapters"):
        return "adapters"
    if parts[:2] == ("packages", "contracts-py") or parts[:2] == ("packages", "contracts-ts"):
        return "contracts"
    if parts[:2] == ("packages", "design-system"):
        return "design-system"
    if parts[:2] == ("packages", "workbench-runtime"):
        return "runtime"
    if parts and parts[0] == "apps":
        return "app"
    return None


def imports(path: Path) -> list[str]:
    text = path.read_text()
    if path.suffix == ".py":
        tree = ast.parse(text, filename=str(path))
        result = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                result.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                prefix = "." * node.level
                result.append(prefix + (node.module or ""))
            elif (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "__import__"
                and node.args
                and isinstance(node.args[0], ast.Constant)
            ):
                result.append(str(node.args[0].value))
        return result
    return IMPORT_RE.findall(text)


def manifest_dependencies(path: Path) -> list[str]:
    if path.name == "package.json":
        manifest = json.loads(path.read_text())
        sections = ("dependencies", "optionalDependencies", "peerDependencies", "devDependencies")
        return [name for section in sections for name in manifest.get(section, {})]
    manifest = tomllib.loads(path.read_text())
    project = manifest.get("project", {})
    entries = list(project.get("dependencies", []))
    entries.extend(manifest.get("build-system", {}).get("requires", []))
    for group in project.get("optional-dependencies", {}).values():
        entries.extend(group)
    return [
        re.split(r"[\s\[<>=!~;@]", entry, maxsplit=1)[0].lower().replace("_", "-")
        for entry in entries
    ]


def dependency_target(imported: str) -> str | None:
    if imported.startswith("@"):
        package = "/".join(imported.split("/")[:2])
        return TYPESCRIPT_INTERNAL.get(package)
    module = imported.lstrip(".").split(".", 1)[0]
    return PYTHON_IMPORTS.get(module)


def check_edge(path: Path, source: str, imported: str, target: str | None) -> list[str]:
    if target is not None and target != source and target not in ALLOWED_TARGETS[source]:
        return [
            f"{path.relative_to(ROOT)}: {source} depends on forbidden {target} target {imported!r}"
        ]
    normalized = imported.lower().replace("_", "-").split("[", 1)[0]
    if source == "core" and normalized in FORBIDDEN_CORE:
        return [f"{path.relative_to(ROOT)}: core depends on forbidden dependency {imported!r}"]
    return []


def violations(paths: list[Path]) -> list[str]:
    findings: list[str] = []
    for path in paths:
        source = owner(path)
        if source is None:
            continue
        if path.name in {"package.json", "pyproject.toml"}:
            for declared in manifest_dependencies(path):
                findings.extend(check_edge(path, source, declared, dependency_target(declared)))
            continue
        for imported in imports(path):
            target = (
                owner((path.parent / imported).resolve())
                if imported.startswith(".")
                else dependency_target(imported)
            )
            findings.extend(check_edge(path, source, imported, target))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="*", type=Path)
    args = parser.parse_args()
    paths = args.paths or sorted(
        path
        for base in (ROOT / "apps", ROOT / "packages")
        for path in base.rglob("*")
        if path.suffix in {".py", ".ts", ".tsx"} or path.name in {"package.json", "pyproject.toml"}
    )
    findings = violations([path if path.is_absolute() else ROOT / path for path in paths])
    if findings:
        raise SystemExit("\n".join(findings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
