"""Application-level router composition."""

from fastapi import APIRouter

from app.router.auth import router as auth_router
from app.router.documents import router as documents_router
from app.router.health import router as health_router
from app.router.readiness import router as readiness_router
from app.router.workspace import router as workspace_router
from app.router.workspace_management import router as workspace_management_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(documents_router)
api_router.include_router(health_router)
api_router.include_router(readiness_router)
api_router.include_router(workspace_router)
api_router.include_router(workspace_management_router)

__all__ = ["api_router"]
