"""Minimal decorator registry used by MCP adapter unit tests."""

from collections.abc import Callable
from typing import Any


class McpServerStub:
    """Capture registered tools and resources without starting an MCP server."""

    def __init__(self) -> None:
        self.tools: dict[str, Callable[..., Any]] = {}
        self.resources: dict[str, Callable[..., Any]] = {}

    def tool(self, name: str | None = None, **_: Any) -> Callable:
        def register(function: Callable) -> Callable:
            if name is not None:
                self.tools[name] = function
            return function

        return register

    def resource(self, uri: str | None = None, **_: Any) -> Callable:
        def register(function: Callable) -> Callable:
            if uri is not None:
                self.resources[uri] = function
            return function

        return register
