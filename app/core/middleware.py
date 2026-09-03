"""Cross-cutting HTTP middleware."""

from collections.abc import Awaitable, Callable
from uuid import UUID, uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.request_context import request_id_context


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a trustworthy request ID to context, state, and response headers."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = _request_id(request.headers.get("x-request-id"))
        request.state.request_id = request_id
        token = request_id_context.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_context.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response


def _request_id(candidate: str | None) -> str:
    if candidate is None:
        return str(uuid4())
    try:
        return str(UUID(candidate))
    except ValueError:
        return str(uuid4())
