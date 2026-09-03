"""Repository and runtime-directory paths."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATIC_ROOT = PROJECT_ROOT / "static"
TEMPLATE_ROOT = PROJECT_ROOT / "template"
RUNTIME_DIRECTORIES = tuple(
    PROJECT_ROOT / name for name in (".backup", "uploads", "feedback", "exports")
)


def ensure_runtime_directories() -> None:
    """Create local runtime directories excluded from Git."""

    for directory in RUNTIME_DIRECTORIES:
        directory.mkdir(parents=True, exist_ok=True)
