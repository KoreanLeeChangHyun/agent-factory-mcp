import os
import shutil
import subprocess
import sys
from pathlib import Path


def test_target_guide_matches_maintained_specification_byte_for_byte() -> None:
    from agent_factory_core.connections.providers.guide import GUIDE

    source = Path(__file__).resolve().parents[3]
    maintained = source / "../docs/skills/design-platform/assets/cloud-integrations.md"
    assert GUIDE.encode() == maintained.read_bytes()


def test_target_guide_imports_from_isolated_installed_package(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[3]
    installed = tmp_path / "site-packages"
    installed.mkdir()
    shutil.copytree(
        source / "packages/platform-core/src/agent_factory_core",
        installed / "agent_factory_core",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    code = """
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from agent_factory_core.connections.providers.guide import GUIDE
assert len(GUIDE.encode()) == 19146
assert 'collection_start' in GUIDE
assert Path(sys.argv[1]) in Path(sys.modules['agent_factory_core.connections.providers.guide'].__file__).parents
"""
    completed = subprocess.run(
        [sys.executable, "-I", "-c", code, str(installed)],
        cwd=tmp_path,
        env={**os.environ, "ENVIRONMENT": "test"},
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
