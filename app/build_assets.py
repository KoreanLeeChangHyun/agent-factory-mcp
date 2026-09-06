"""Setuptools hook packaging deployment resources from their maintained source roots."""

from pathlib import Path
from shutil import copy2
from setuptools.command.build_py import build_py


class BuildPy(build_py):
    def run(self):
        super().run()
        root = Path(__file__).resolve().parents[1]
        target = Path(self.build_lib) / 'app' / 'resources' / 'runtime'
        for name in ('static', 'template', 'config', 'docs'):
            source = root / name
            if not source.is_dir():
                raise RuntimeError(f'missing deployment resource root: {name}')
            for path in source.rglob('*'):
                if path.is_symlink():
                    raise RuntimeError(f'deployment resource symlink needs an explicit packaging rule: {path}')
                if path.is_file():
                    destination = target / path.relative_to(root)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    copy2(path, destination)
