"""Application-level router composition."""

from fastapi import APIRouter

from app.router.health import router as health_router
from app.router.readiness import router as readiness_router
from app.router.workspace import router as workspace_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(readiness_router)
api_router.include_router(workspace_router)

__all__ = ["api_router"]
