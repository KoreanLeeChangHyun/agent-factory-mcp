"""Read the discoverable guide inside the built runtime image, without host mounts.

Run through scripts/verify-reporting-runtime.sh; a missing image is an error.
"""

import os
import subprocess
import textwrap

import pytest


@pytest.mark.integration
def test_reporting_guide_in_runtime_image():
    image = os.environ["REPORTING_RUNTIME_IMAGE"]
    probe = textwrap.dedent(r"""
        import asyncio
        import json
        import re
        from pathlib import Path
        from app.mcp.reporting import GUIDE
        from app.mcp.server import create_mcp_server
        from app.modules.reporting.schemas import Command, ResultWrite

        async def main():
            assert Path.cwd() == Path('/srv/agent-factory')
            assert GUIDE == Path('/srv/agent-factory/docs/external-agent-reporting.md')
            server = create_mcp_server()
            resources = await server.list_resources()
            assert 'agent-factory://reporting/guide' in {str(r.uri) for r in resources}
            contents = list(await server.read_resource('agent-factory://reporting/guide'))
            assert len(contents) == 1
            guide = contents[0].content
            assert isinstance(guide, str) and guide == GUIDE.read_text(encoding='utf-8')
            assert 'reporting_write' in guide and 'reporting_read' in guide
            examples = re.findall(r'```json\n(.*?)\n```', guide, re.S)
            assert len(examples) >= 7
            for example in examples:
                value = json.loads(example)
                if 'command' in value:
                    Command.model_validate(value['command'])
                else:
                    ResultWrite.model_validate(value)
            print('Runtime MCP reporting guide read successfully')

        asyncio.run(main())
    """)
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--interactive",
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--env",
            "AGENT_FACTORY_ENVIRONMENT=test",
            "--env",
            "AGENT_FACTORY_DATABASE_URL=postgresql+asyncpg://invalid:invalid@127.0.0.1:1/verification",
            image,
            "python",
            "-",
        ],
        input=probe,
        text=True,
        capture_output=True,
        timeout=120,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Runtime MCP reporting guide read successfully" in result.stdout
