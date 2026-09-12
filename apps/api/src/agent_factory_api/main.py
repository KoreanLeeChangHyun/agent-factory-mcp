from __future__ import annotations

import os

from agent_factory_adapters import FixtureWorkbenchRepository
from agent_factory_core import GetReferenceWorkbench
from fastapi import FastAPI, Response, status


def create_app() -> FastAPI:
    app = FastAPI(title="Agent Factory Workbench API", version="0.1.0")
    query = GetReferenceWorkbench(FixtureWorkbenchRepository())

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
        return dict(query.execute())

    return app


app = create_app()
