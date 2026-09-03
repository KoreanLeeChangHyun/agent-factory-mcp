"""Metrics, tracing, and mutation audit middleware."""

import logging
from collections.abc import Awaitable, Callable
from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Request, Response
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware

from app.db.session import get_session_factory
from app.modules.audit.repository import AuditRepository

logger = logging.getLogger(__name__)
REQUESTS = Counter(
    "agent_factory_http_requests_total", "HTTP requests", ["method", "route", "status"]
)
DURATION = Histogram("agent_factory_http_request_seconds", "HTTP latency", ["method", "route"])
_tracing_configured = False


def configure_tracing(service_name: str) -> None:
    global _tracing_configured
    if not _tracing_configured:
        trace.set_tracer_provider(
            TracerProvider(resource=Resource.create({"service.name": service_name}))
        )
        _tracing_configured = True


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        started = perf_counter()
        response = await call_next(request)
        route = getattr(request.scope.get("route"), "path", "unmatched")
        REQUESTS.labels(request.method, route, str(response.status_code)).inc()
        DURATION.labels(request.method, route).observe(perf_counter() - started)
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            await self._audit(request, response, route)
        return response

    async def _audit(self, request: Request, response: Response, route: str) -> None:
        try:
            principal = getattr(request.state, "principal", None)
            path = request.path_params
            async with get_session_factory()() as session:
                await AuditRepository(session).append(
                    actor_user_id=getattr(principal, "user_id", None),
                    organization_id=_uuid(path.get("organization_id")),
                    workspace_id=_uuid(path.get("workspace_id")),
                    action=f"{request.method.lower()}:{route}",
                    outcome="success" if response.status_code < 400 else "failure",
                    request_id=getattr(request.state, "request_id", None),
                    target_type=next(reversed(path), None) if path else None,
                    target_id=str(next(reversed(path.values()), "")) or None,
                    metadata={"status_code": response.status_code},
                )
        except Exception:
            logger.exception("audit_event_write_failed")


def _uuid(value: object) -> UUID | None:
    try:
        return UUID(str(value)) if value else None
    except ValueError:
        return None


router = APIRouter(tags=["observability"])


@router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
