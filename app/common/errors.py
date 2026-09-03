"""Application error types shared across delivery adapters."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ApplicationError(Exception):
    """A safe, structured error that may cross an API boundary."""

    code: str
    message: str
    status_code: int = 400
    details: dict[str, Any] = field(default_factory=dict)


class NotFoundError(ApplicationError):
    """A requested domain object does not exist in the caller's scope."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(code=code, message=message, status_code=404)


class ConflictError(ApplicationError):
    """The requested mutation conflicts with current authoritative state."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(code=code, message=message, status_code=409)


class PermissionDeniedError(ApplicationError):
    """The authenticated principal lacks the required permission."""

    def __init__(self, code: str, message: str = "Permission denied") -> None:
        super().__init__(code=code, message=message, status_code=403)


class AuthenticationError(ApplicationError):
    """Authentication did not establish an active principal."""

    def __init__(self, code: str, message: str = "Authentication failed") -> None:
        super().__init__(code=code, message=message, status_code=401)
