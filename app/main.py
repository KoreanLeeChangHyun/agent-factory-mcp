"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.api.errors import install_exception_handlers
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.paths import ensure_runtime_directories
from app.db.session import dispose_engine
from app.mcp.server import create_mcp_server
from app.router import api_router


def create_app() -> FastAPI:
    """Build an isolated ASGI application for each process or test lifecycle."""

    mcp_server = create_mcp_server()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        ensure_runtime_directories()
        async with mcp_server.session_manager.run():
            try:
                yield
            finally:
                await dispose_engine()

    configure_logging(settings.log_level)
    application = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
    application.add_middleware(
        SessionMiddleware,
        secret_key=settings.auth_token_secret.get_secret_value(),
        session_cookie="agent_factory_oauth_state",
        same_site="lax",
        https_only=settings.session_cookie_secure,
    )
    application.add_middleware(RequestContextMiddleware)
    install_exception_handlers(application)
    application.include_router(api_router)
    application.mount(
        "/mcp",
        mcp_server.streamable_http_app(streamable_http_path="/"),
        name="mcp",
    )
    return application


app = create_app()
