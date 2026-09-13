"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from api.http.responses.errors import install_exception_handlers
from api.settings import settings
from api.logging import configure_logging
from api.http.middleware.context import RequestContextMiddleware
from api.observability import ObservabilityMiddleware, configure_tracing
from api.paths import WORKBENCH_WEB_ROOT
from api.mcp.auth import ApiTokenVerifier
from api.http.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware
from agent_factory_adapters.postgres.database.session import dispose_engine
from api.mcp.scoped import WorkspaceMCPTransport
from api.mcp.server import create_mcp_server
from api.http.endpoints import api_router
from api.http.endpoints.target_workbenches import router as target_workbenches_router


def create_app() -> FastAPI:
    """Build an isolated ASGI application for each process or test lifecycle."""

    mcp_server = create_mcp_server()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        async with mcp_server.session_manager.run():
            try:
                yield
            finally:
                await dispose_engine()

    configure_logging(settings.log_level)
    configure_tracing("agent-factory-mcp")
    application = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
        root_path=settings.root_path,
    )
    application.add_middleware(
        SessionMiddleware,
        secret_key=settings.auth_token_secret.get_secret_value(),
        session_cookie="agent_factory_oauth_state",
        path=settings.root_path or "/",
        same_site="lax",
        https_only=settings.session_cookie_secure,
    )
    application.add_middleware(RequestContextMiddleware)
    application.add_middleware(ObservabilityMiddleware)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RateLimitMiddleware, settings=settings)
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    if settings.cors_allowed_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=[
                "Authorization",
                "Content-Type",
                "X-CSRF-Token",
                "X-Organization-ID",
                "X-Request-ID",
                "X-Workspace-ID",
            ],
        )
    install_exception_handlers(application)
    application.include_router(api_router)
    application.include_router(target_workbenches_router)
    application.mount("/workbench", StaticFiles(directory=WORKBENCH_WEB_ROOT, html=True), name="workbench")
    application.mount(
        "/mcp",
        WorkspaceMCPTransport(
            mcp_server.streamable_http_app(
                streamable_http_path="/",
                # Requests can reach different workers; credentials authorize each request.
                stateless_http=True,
                transport_security=TransportSecuritySettings(
                    allowed_hosts=[
                        urlsplit(settings.public_base_url).netloc,
                        "127.0.0.1:*",
                        "localhost:*",
                        "[::1]:*",
                    ],
                    allowed_origins=[
                        f"{urlsplit(settings.public_base_url).scheme}://{urlsplit(settings.public_base_url).netloc}",
                        *settings.cors_allowed_origins,
                    ],
                ),
            ),
            token_verifier=ApiTokenVerifier(settings),
        ),
        name="mcp",
    )
    return application


app = create_app()
