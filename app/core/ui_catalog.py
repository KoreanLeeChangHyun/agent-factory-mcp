"""Explicit runtime file boundary for the private UI catalog."""

from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=8)
def _catalog_entries(root: Path) -> tuple[tuple[str, Path], ...]:
    candidates = [root / "index.html"]
    for pattern in ("*.js", "*.css"):
        candidates.extend(root.glob(pattern))
    for directory in ("catalog", "generated", "src", "styles", "vendor"):
        candidates.extend((root / directory).rglob("*"))
    resolved_root = root.resolve()
    return tuple(
        sorted(
            (path.relative_to(root).as_posix(), path)
            for path in candidates
            if path.is_file()
            and not path.is_symlink()
            and path.resolve().is_relative_to(resolved_root)
        )
    )


def catalog_files(root: Path) -> dict[str, Path]:
    """Return the allowlisted catalog manifest without rescanning it per request."""

    return dict(_catalog_entries(root.resolve()))
