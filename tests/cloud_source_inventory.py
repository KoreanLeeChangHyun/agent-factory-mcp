"""Current distributable test inputs, including nonignored untracked source."""
import json
import subprocess
from hashlib import sha256
from importlib.resources import files as resources
from pathlib import Path


def git_source_files(root: Path, *prefixes: str) -> dict[str, bytes]:
    def names(*options):
        raw = subprocess.check_output(['git', '-C', str(root), 'ls-files', *options, '-z', '--', *prefixes])
        return {name.decode() for name in raw.split(b'\0') if name}
    deleted = names('--deleted')
    candidates = names('--cached', '--others', '--exclude-standard') - deleted
    result = {}
    for name in sorted(candidates):
        path = root / name
        if any(part in {'__pycache__', '.pytest_cache', '.venv', 'node_modules', 'build', 'dist'} for part in path.parts) or path.suffix in {'.pyc', '.pyo'}:
            continue
        if path.is_symlink() or any(parent.is_symlink() for parent in path.parents if parent != root):
            raise AssertionError(f'Source symlink requires explicit packaging authority: {name}')
        # Only Git-confirmed deletions are omitted; unexpected missing files fail.
        result[name] = path.read_bytes()
    assert result, 'Current Git distributable source inventory is required'
    return result


def template_source_files() -> dict[str, bytes]:
    root = resources('app.resources')
    manifest = json.loads(root.joinpath('document_template_inventory.json').read_bytes())
    result = {}
    for name, expected in manifest.items():
        raw = root.joinpath('document_template', *name.split('/')).read_bytes()
        size, digest = len(raw), sha256(raw).hexdigest()
        assert size == expected['size_bytes'], name
        assert digest == expected['sha256'], name
        result[name] = raw
    assert {'index.html', 'styles.css', 'app.js', 'library.css', 'THIRD_PARTY_NOTICES.txt',
            'vendor/mermaid/11.17.2/LICENSE', 'vendor/tabulator/6.5.2/LICENSE'} <= result.keys()
    return result


def assert_same_bytes(actual, expected, name):
    """Report only length/digest mismatches, never large payload bytes."""
    actual_size, expected_size = len(actual), len(expected)
    actual_hash, expected_hash = sha256(actual).hexdigest(), sha256(expected).hexdigest()
    assert actual_size == expected_size, name
    assert actual_hash == expected_hash, name
