"""Application-level router composition."""

from fastapi import APIRouter

from app.core.observability import router as observability_router
from app.router.account import router as account_router
from app.router.appearance import router as appearance_router
from app.router.admin import router as admin_router
from app.router.agents import router as agents_router
from app.router.audit import router as audit_router
from app.router.auth import router as auth_router
from app.router.cloud_documents import router as cloud_documents_router
from app.router.documents import router as documents_router
from app.router.health import router as health_router
from app.router.integration_oauth import router as integration_oauth_router
from app.router.integrations import router as integrations_router
from app.router.mcp_connections import router as mcp_connections_router
from app.router.planning import router as planning_router
from app.router.reporting import router as reporting_router
from app.router.readiness import router as readiness_router
from app.router.scheduling import router as scheduling_router
from app.router.search import router as search_router
from app.router.workspace import router as workspace_router
from app.router.workspace_management import router as workspace_management_router

from app.router.organizations import router as organizations_router

api_router = APIRouter()
api_router.include_router(organizations_router)
api_router.include_router(account_router)
api_router.include_router(appearance_router)
api_router.include_router(admin_router)
api_router.include_router(agents_router)
api_router.include_router(auth_router)
api_router.include_router(audit_router)
api_router.include_router(documents_router)
api_router.include_router(cloud_documents_router)
api_router.include_router(search_router)
api_router.include_router(health_router)
api_router.include_router(integrations_router)
api_router.include_router(integration_oauth_router)
api_router.include_router(observability_router)
api_router.include_router(mcp_connections_router)
api_router.include_router(planning_router)
api_router.include_router(reporting_router)
api_router.include_router(readiness_router)
api_router.include_router(scheduling_router)
api_router.include_router(workspace_router)
api_router.include_router(workspace_management_router)

__all__ = ["api_router"]
