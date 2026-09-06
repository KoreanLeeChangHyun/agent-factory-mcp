"""The advertised resource must work without checkout-only docs assets."""

import os
from pathlib import Path
import shutil
import subprocess
import sys


def test_resource_reads_from_isolated_installed_app_layout(tmp_path):
    source = Path(__file__).resolve().parents[1]
    installed = tmp_path / 'site-packages'
    installed.mkdir()
    shutil.copytree(source / 'app', installed / 'app', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    assert not (installed / 'docs').exists()
    code = '''
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from mcp.server import MCPServer
from app.mcp.integrations import install_integrations
from app.modules.integration import cloud_guide
assert Path(cloud_guide.__file__).is_relative_to(Path(sys.argv[1]))
async def denied(*args):
    raise AssertionError('resource reading must not authorize or perform I/O')
async def main():
    server = MCPServer('installed-guide-check')
    install_integrations(server, denied)
    resources = list(await server.read_resource('agent-factory://integrations/guide'))
    assert len(resources) == 1
    assert resources[0].content == cloud_guide.GUIDE
    assert 'collection_start' in resources[0].content
    assert 'Notion' in resources[0].content
asyncio.run(main())
'''
    environment = {**os.environ, 'ENVIRONMENT': 'test'}
    completed = subprocess.run([sys.executable, '-I', '-c', code, str(installed)],
                               cwd=tmp_path, env=environment, capture_output=True, text=True, timeout=30)
    assert completed.returncode == 0, completed.stdout + completed.stderr


def test_packaged_guide_is_synchronized_with_maintained_markdown():
    from app.modules.integration.cloud_guide import GUIDE
    assert GUIDE == (Path(__file__).resolve().parents[1] / 'docs/cloud-integrations.md').read_text()
