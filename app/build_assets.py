"""Setuptools hook packaging deployment resources from their maintained source roots."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from shutil import copy2, rmtree

from setuptools.command.build_py import build_py


def _catalog_files(root: Path):
    """Load the catalog policy without requiring the source root on sys.path."""
    module_path = Path(__file__).resolve().parent / "core" / "ui_catalog.py"
    spec = spec_from_file_location("_agent_factory_ui_catalog", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load UI catalog policy: {module_path}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.catalog_files(root)


class BuildPy(build_py):
    def run(self):
        super().run()
        root = Path(__file__).resolve().parents[1]
        target = Path(self.build_lib) / "app" / "resources" / "runtime"
        for name in ("static", "template", "config", "docs"):
            source = root / name
            if not source.is_dir():
                raise RuntimeError(f"missing deployment resource root: {name}")
            for path in source.rglob("*"):
                relative = path.relative_to(source)
                if path.is_symlink():
                    raise RuntimeError(
                        f"deployment resource symlink needs an explicit packaging rule: {path}"
                    )
                if name == "docs" and relative.parts[:1] == ("ui-kit",):
                    continue
                if path.is_file():
                    destination = target / path.relative_to(root)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    copy2(path, destination)
        catalog_root = root / "assets" / "ui-kit"
        if not (catalog_root / "index.html").is_file():
            raise RuntimeError("missing private UI catalog")
        catalog_target = target / "assets" / "ui-kit"
        if catalog_target.exists():
            rmtree(catalog_target)
        for relative, path in _catalog_files(catalog_root).items():
            destination = catalog_target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            copy2(path, destination)
