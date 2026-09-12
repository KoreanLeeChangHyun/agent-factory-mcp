"""Pure Workspace naming, isolation and repository-identity decisions."""

from urllib.parse import urlsplit, urlunsplit

from agent_factory_core.shared.errors import ApplicationError, ConflictError


def normalize_group_name(name: str) -> str:
    return " ".join(name.strip().split())


def require_unique_group_name(name: str, existing_names: list[str]) -> str:
    normalized = normalize_group_name(name)
    if any(item.casefold() == normalized.casefold() for item in existing_names):
        raise ConflictError("workspace_group_name_exists", "같은 이름의 그룹이 이미 있습니다.")
    return normalized


def canonical_remote_repository(location: str) -> str:
    value = location.strip()
    if any(ord(character) < 32 for character in value):
        raise ApplicationError(
            "invalid_repository_location", "Repository location contains control characters"
        )
    if value.startswith("git@") and ":" in value:
        host, path = value[4:].split(":", 1)
        canonical = f"ssh://git@{host.casefold()}/{path}"
    elif value.startswith("ssh://"):
        parts = urlsplit(value)
        canonical = urlunsplit(("ssh", parts.netloc.casefold(), parts.path, "", ""))
    elif value.startswith(("https://", "git://")):
        parts = urlsplit(value)
        canonical = urlunsplit((parts.scheme, parts.netloc.casefold(), parts.path, "", ""))
    else:
        raise ApplicationError(
            "remote_repository_required", "A remote HTTPS, SSH, or Git repository is required", 400
        )
    return canonical.removesuffix("/").removesuffix(".git")
