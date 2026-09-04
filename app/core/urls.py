"""Public URL-path helpers for root and subpath deployments."""

from app.core.config import settings


def public_path(path: str) -> str:
    """Return an absolute browser path below the configured deployment root."""

    if not path.startswith("/"):
        raise ValueError("public paths must start with a slash")
    return f"{settings.root_path}{path}"
