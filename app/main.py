"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import install_exception_handlers
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.paths import ensure_runtime_directories
from app.mcp.server import mcp_server
from app.router import api_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Start shared application resources."""

    ensure_runtime_directories()
    async with mcp_server.session_manager.run():
        yield


configure_logging(settings.log_level)
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
app.add_middleware(RequestContextMiddleware)
install_exception_handlers(app)
app.include_router(api_router)
app.mount(
    "/mcp",
    mcp_server.streamable_http_app(streamable_http_path="/"),
    name="mcp",
)
