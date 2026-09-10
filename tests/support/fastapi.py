"""FastAPI test helpers for temporary dependency overrides."""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any

from fastapi import FastAPI


@contextmanager
def dependency_override(
    application: FastAPI,
    dependency: Callable[..., Any],
    replacement: Callable[..., Any],
) -> Iterator[None]:
    """Restore the previous override after a scoped request assertion."""

    missing = object()
    previous = application.dependency_overrides.get(dependency, missing)
    application.dependency_overrides[dependency] = replacement
    try:
        yield
    finally:
        if previous is missing:
            application.dependency_overrides.pop(dependency, None)
        else:
            application.dependency_overrides[dependency] = previous
