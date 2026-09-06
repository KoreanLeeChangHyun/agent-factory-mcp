"""Repository and runtime-directory paths."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = PROJECT_ROOT if (PROJECT_ROOT / "static").is_dir() else (
    Path(__file__).resolve().parents[1] / "resources" / "runtime"
)
STATIC_ROOT = ASSET_ROOT / "static"
TEMPLATE_ROOT = ASSET_ROOT / "template"
RUNTIME_ROOT = PROJECT_ROOT if ASSET_ROOT == PROJECT_ROOT else Path.cwd()
RUNTIME_DIRECTORIES = tuple(
    RUNTIME_ROOT / name for name in (".backup", "uploads", "feedback", "exports")
)


def ensure_runtime_directories() -> None:
    """Create local runtime directories excluded from Git."""

    for directory in RUNTIME_DIRECTORIES:
        directory.mkdir(parents=True, exist_ok=True)
