"""Framework-independent application errors shared by core use cases."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ApplicationError(Exception):
    code: str
    message: str
    status_code: int = 400
    details: dict[str, Any] = field(default_factory=dict)


class NotFoundError(ApplicationError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, 404)


class ConflictError(ApplicationError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, 409)


class PermissionDeniedError(ApplicationError):
    def __init__(self, code: str, message: str = "Permission denied") -> None:
        super().__init__(code, message, 403)


class AuthenticationError(ApplicationError):
    def __init__(self, code: str, message: str = "Authentication failed") -> None:
        super().__init__(code, message, 401)
