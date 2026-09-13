"""Structured process logging."""

import json
import logging
from typing import Any

from agent_factory_core.shared.request_context import request_id_context


class JsonFormatter(logging.Formatter):
    """Render one machine-readable JSON object per log record."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = request_id_context.get()
        if request_id:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


class AccessQueryFilter(logging.Filter):
    """Remove query strings before Uvicorn interpolates its access-log arguments."""

    def filter(self, record):
        if isinstance(record.args, tuple) and len(record.args) == 5:
            args = list(record.args)
            args[2] = str(args[2]).split('?', 1)[0]
            record.args = tuple(args)
        return True


def configure_logging(level: str) -> None:
    """Configure the root logger once for API, worker, and scheduler processes."""

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    access = logging.getLogger("uvicorn.access")
    if not any(isinstance(item, AccessQueryFilter) for item in access.filters):
        access.addFilter(AccessQueryFilter())
    # Provider request URLs can contain short-lived signed download credentials.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
