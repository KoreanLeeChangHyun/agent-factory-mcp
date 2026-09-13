"""HTTP rendering for application errors."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from agent_factory_core.shared.errors import ApplicationError


def install_exception_handlers(app: FastAPI) -> None:
    """Install stable error envelopes without exposing internal exceptions."""

    @app.exception_handler(ApplicationError)
    async def application_error_handler(request: Request, exc: ApplicationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "request_id": request_id,
                }
            },
        )
