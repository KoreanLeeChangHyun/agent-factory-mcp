"""Real, billed Codex smoke/latency benchmark, not a coding quality benchmark.

python3 mcp/tests/support/runtime_comparison/compare_codex.py --model MODEL --output DIR
Uses existing Codex authentication. Does not change user config or production code.
Each round makes six requests: Python/Node exec plus cold/reused app-server.
All turns use new ephemeral threads. Reused means server reuse, not chat history.
Timing ends at turn completion (excludes shutdown); exec exposes no comparable
token delta, so reply_ms measures completed agent messages in both transports.
No automatic retries or arbitrary execution timeouts. Ctrl-C cancels the run.
"""
import argparse
import json
import os
import platform
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', required=True)
    parser.add_argument('--effort', default='medium')
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.rounds < 1:
        parser.error('--rounds must be positive')
    codex, node = shutil.which('codex'), shutil.which('node')
    if not codex or not node:
        parser.error('codex and node must be installed')
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parent
    config_path = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'config.toml'
    user = tomllib.loads(config_path.read_text()) if config_path.exists() else {}
    overrides = {'model': args.model, 'model_reasoning_effort': args.effort,
                 'approval_policy': 'never', 'sandbox_mode': 'read-only',
                 'project_doc_max_bytes': 0, 'web_search': 'disabled',
                 'features.shell_tool': False, 'features.apps': False,
                 'features.multi_agent': False}
    # Disable configured integrations individually: overriding a table with {}
    # may merge with existing entries instead of removing them.
    for name in user.get('mcp_servers', {}):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', name):
            parser.error('Benchmark supports only simple MCP config key names')
        overrides[f'mcp_servers.{name}.enabled'] = False
    common = [token for key, value in overrides.items()
              for token in ('-c', f'{key}={json.dumps(value)}')]
    report = {'model': args.model, 'effort': args.effort, 'rounds': args.rounds,
              'codex': subprocess.check_output([codex, '--version'], text=True).strip(),
              'python': sys.version.split()[0],
              'node': subprocess.check_output([node, '--version'], text=True).strip(),
              'platform': platform.platform(), 'overrides': overrides,
              'limitations': 'Small sequential smoke test; network/cache/server variability; '
                             'same user config remains; no coding task or tool calls.',
              'runs': []}
    prompt = 'This is a transport latency test. Do not use any tools. Reply with exactly BENCH_OK and nothing else.'
    pairs = [('python', 'exec'), ('node', 'exec'), ('python', 'app-server'), ('node', 'app-server')]
    with tempfile.TemporaryDirectory(prefix='codex-transport-benchmark-') as cwd:
        for round_index in range(args.rounds):
            order = pairs if round_index % 2 == 0 else list(reversed(pairs))
            for language, mode in order:
                label = f'{round_index + 1}-{language}-{mode}'
                print(f'Running {label}', flush=True)
                invocation = [mode, *common]
                if mode == 'exec':
                    invocation += ['--ephemeral', '--skip-git-repo-check', '--json', prompt]
                else:
                    invocation += ['--listen', 'stdio://']
                config = {'codex': codex, 'args': invocation, 'cwd': cwd, 'mode': mode,
                          'model': args.model, 'effort': args.effort, 'prompt': prompt,
                          'stderrPath': str(out / f'{label}.stderr.log')}
                path = out / f'{label}.config.json'
                path.write_text(json.dumps(config, indent=2))
                client = [sys.executable, str(root / 'codex_client.py')] if language == 'python' else [node, str(root / 'codex_client.mjs')]
                process = subprocess.run([*client, str(path)], capture_output=True, text=True)
                (out / f'{label}.client.stderr.log').write_text(process.stderr)
                if process.returncode:
                    report['failure'] = {'run': label, 'exit_code': process.returncode}
                    (out / 'report.json').write_text(json.dumps(report, indent=2))
                    raise RuntimeError(f'{label} failed; inspect {out}')
                data = json.loads(process.stdout)
                (out / f'{label}.json').write_text(json.dumps(data, indent=2))
                report['runs'].append({'round': round_index + 1, 'language': language, **data})
                (out / 'report.json').write_text(json.dumps(report, indent=2))
                print([(s['case'], round(s['total_ms'], 1)) for s in data['samples']], flush=True)
    summary = []
    for language in ('python', 'node'):
        for case in ('exec', 'app-cold', 'app-reused'):
            samples = [s for r in report['runs'] if r['language'] == language
                       for s in r['samples'] if s['case'] == case]
            values = [s['total_ms'] for s in samples]
            summary.append({'language': language, 'case': case, 'count': len(values),
                            'median_ms': statistics.median(values), 'min_ms': min(values),
                            'max_ms': max(values)})
    report['summary'] = summary
    (out / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
