"""HTTP hardening, distributed rate limiting, and outbound URL policy."""

import ipaddress
import logging
from collections.abc import Awaitable, Callable
from hashlib import sha256
from urllib.parse import urlsplit

from fastapi import Request, Response
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import Settings

logger = logging.getLogger(__name__)
SENSITIVE_PREFIXES = ("/api/auth/login", "/api/webhooks/", "/mcp")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.update(
            {
                "Content-Security-Policy": (
                    "default-src 'self'; script-src 'self'; style-src 'self'; "
                    "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; "
                    "base-uri 'none'; form-action 'self'"
                ),
                "Referrer-Policy": "no-referrer",
                "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Cross-Origin-Opener-Policy": "same-origin",
            }
        )
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, settings: Settings) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.settings = settings
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not self.settings.rate_limit_enabled or not request.url.path.startswith(
            SENSITIVE_PREFIXES
        ):
            return await call_next(request)
        identity = sha256(
            f"{request.client.host if request.client else 'unknown'}:{request.url.path}".encode()
        ).hexdigest()
        key = f"agent-factory:rate:{identity}"
        try:
            count = await self.redis.incr(key)
            if count == 1:
                await self.redis.expire(key, self.settings.rate_limit_window_seconds)
        except Exception:
            logger.exception("rate_limit_backend_unavailable")
            if self.settings.environment in {"staging", "production"}:
                return Response("Rate limit service unavailable", status_code=503)
            return await call_next(request)
        if count > self.settings.rate_limit_requests:
            return Response(
                "Too many requests",
                status_code=429,
                headers={"Retry-After": str(self.settings.rate_limit_window_seconds)},
            )
        return await call_next(request)


def validate_public_https_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("outbound URL must be credential-free HTTPS")
    hostname = parsed.hostname.casefold()
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise ValueError("outbound URL cannot target localhost")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return value
    if not address.is_global:
        raise ValueError("outbound URL cannot target a private or reserved address")
    return value
