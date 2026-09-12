from __future__ import annotations

from collections.abc import Sequence

from .domain import ThemeProfile


class ThemeValidationError(ValueError):
    def __init__(self, messages: Sequence[str]) -> None:
        self.messages = tuple(messages)
        super().__init__("; ".join(self.messages))


class ThemeConflictError(RuntimeError):
    def __init__(self, current: ThemeProfile) -> None:
        self.current = current
        super().__init__("theme profile revision conflict")
