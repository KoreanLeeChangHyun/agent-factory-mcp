from __future__ import annotations

import os

from agent_factory_contracts import validate
from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE
from fastapi import FastAPI, Response, status


def create_app() -> FastAPI:
    app = FastAPI(title="Agent Factory Workbench API", version="0.1.0")

    @app.get("/livez")
    def liveness() -> dict[str, str]:
        return {"status": "live"}

    @app.get("/readyz")
    def readiness(response: Response) -> dict[str, object]:
        database_configured = bool(os.getenv("DATABASE_URL"))
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not-ready",
            "database": {"configured": database_configured, "checked": False},
        }

    @app.get("/workbench/reference")
    def reference_workbench() -> dict[str, object]:
        validate(DOCUMENTS_FIXTURE)
        return dict(DOCUMENTS_FIXTURE)

    return app


app = create_app()
