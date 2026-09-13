"""Locate the built web application without depending on retired static/templates."""

import os
from pathlib import Path


def web_root() -> Path:
    configured = os.environ.get("AGENT_FACTORY_WEB_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    root = next((p for p in Path(__file__).resolve().parents if (p / "pnpm-workspace.yaml").is_file()), None)
    if root is not None:
        return root / "apps" / "web" / "dist"
    return Path(__file__).resolve().parent / "resources" / "web"


WORKBENCH_WEB_ROOT = web_root()
