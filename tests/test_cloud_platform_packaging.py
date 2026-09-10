"""Verification builds an isolated wheel and checks source-byte deployment fidelity."""

import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


def test_deployment_wheel_contains_guides_preview_and_all_browser_assets(tmp_path):
    root = Path(__file__).resolve().parents[1]
    source = tmp_path / "source"
    source.mkdir()
    for name in ("app", "static", "template", "config", "docs"):
        shutil.copytree(
            root / name, source / name, ignore=shutil.ignore_patterns("__pycache__", "*.pyc")
        )
    for name in ("pyproject.toml", "README.md", "MANIFEST.in"):
        shutil.copy2(root / name, source / name)
    wheels = tmp_path / "wheels"
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "wheel",
            "--no-deps",
            "--no-build-isolation",
            "--wheel-dir",
            str(wheels),
            str(source),
        ],
        check=True,
        cwd=tmp_path,
    )
    wheel = next(wheels.glob("agent_factory_mcp-*.whl"))
    installed = tmp_path / "installed"
    with zipfile.ZipFile(wheel) as archive:
        assert (
            archive.read("app/modules/document/preview_runtime.js")
            == (root / "app/modules/document/preview_runtime.js").read_bytes()
        )
        for name in ("static", "template", "config", "docs"):
            for path in (root / name).rglob("*"):
                if path.is_file() and not path.is_symlink():
                    if name == "docs" and path.relative_to(root / name).parts[:1] == ("ui-kit",):
                        continue
                    assert (
                        archive.read("app/resources/runtime/" + path.relative_to(root).as_posix())
                        == path.read_bytes()
                    )
        assert not any(
            name.startswith("app/resources/runtime/docs/ui-kit/") for name in archive.namelist()
        )
        for path in (root / "app/resources/document_template").rglob("*"):
            if path.is_file():
                assert archive.read(path.relative_to(root).as_posix()) == path.read_bytes()
        assert (
            archive.read("app/resources/document_template_inventory.json")
            == (root / "app/resources/document_template_inventory.json").read_bytes()
        )
        archive.extractall(installed)
    code = """
import asyncio, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from app.core.paths import STATIC_ROOT, TEMPLATE_ROOT
assert STATIC_ROOT.is_relative_to(Path(sys.argv[1]))
assert (STATIC_ROOT / 'js/document-editor.js').is_file()
assert (TEMPLATE_ROOT / 'workspace/index.html').is_file()
from app.mcp.server import create_mcp_server
from app.modules.document.template import TemplateRequest, read_template
manifest = read_template(TemplateRequest())
assert "vendor/mermaid/11.17.2/LICENSE" in manifest["files"]
assert read_template(TemplateRequest(operation="read", path="index.html", version=manifest["version"]))["content_base64"]
from app.modules.document.preview import render_preview
assert 'packageData' in render_preview({'index.html': b'<p>fixture</p>'}, 'index.html')
async def main():
    server = create_mcp_server()
    for uri in ('agent-factory://integrations/guide', 'agent-factory://reporting/guide',
                'agent-factory://reporting/cloud-guide', 'agent-factory://planning/import-guide'):
        assert list(await server.read_resource(uri))
asyncio.run(main())
"""
    environment = {**os.environ, "AGENT_FACTORY_ENV_FILE": "", "AGENT_FACTORY_ENVIRONMENT": "test"}
    subprocess.run(
        [sys.executable, "-I", "-c", code, str(installed)],
        cwd=tmp_path,
        env=environment,
        check=True,
        timeout=45,
    )
