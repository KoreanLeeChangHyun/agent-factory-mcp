"""Per-request diagnostic context."""

from contextvars import ContextVar

request_id_context: ContextVar[str | None] = ContextVar("request_id", default=None)
