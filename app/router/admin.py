"""Platform administrator UI and API."""

from pathlib import Path, PurePosixPath
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.paths import STATIC_ROOT
from app.db.session import get_session
from app.modules.admin.repository import AdminRepository
from app.modules.admin.schemas import (
    AdminIntegrationResponse,
    AdminJobResponse,
    AdminOrganizationResponse,
    AdminUserResponse,
    AdminWorkspaceResponse,
    AuditEventResponse,
    DashboardResponse,
    FeatureFlagResponse,
    FeatureFlagUpdate,
    OwnershipGrant,
    RuntimeInfoResponse,
    UserStatusUpdate,
)
from app.modules.admin.service import AdminService
from app.modules.auth.authorization_dependencies import require_platform_admin
from app.modules.auth.dependencies import require_csrf
from app.modules.auth.service import Principal

router = APIRouter(tags=["admin"])
ADMIN_ASSET_ROOT = (STATIC_ROOT / "admin").resolve()


async def get_admin_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    principal: Annotated[Principal, Depends(require_platform_admin)],
) -> AdminService:
    service = AdminService(AdminRepository(session), settings)
    await service.establish(principal)
    return service


def _admin_asset(asset_path: str) -> Path:
    relative = PurePosixPath(asset_path or "index.html")
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        raise HTTPException(status_code=400, detail="Invalid admin asset path")
    unresolved = ADMIN_ASSET_ROOT.joinpath(*relative.parts)
    current = ADMIN_ASSET_ROOT
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise HTTPException(status_code=404, detail="Admin asset not found")
    try:
        candidate = unresolved.resolve(strict=True)
        candidate.relative_to(ADMIN_ASSET_ROOT)
    except (FileNotFoundError, OSError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="Admin asset not found") from exc
    if not candidate.is_file() or candidate.is_symlink():
        raise HTTPException(status_code=404, detail="Admin asset not found")
    return candidate


@router.api_route("/admin/{asset_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def admin_asset(asset_path: str) -> FileResponse:
    return FileResponse(
        _admin_asset(asset_path),
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/admin", include_in_schema=False)
async def admin_root() -> RedirectResponse:
    return RedirectResponse("/admin/", status_code=307)


@router.get("/api/admin/dashboard", response_model=DashboardResponse)
async def dashboard(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> DashboardResponse:
    return DashboardResponse(**await service.dashboard())


@router.get("/api/admin/users", response_model=list[AdminUserResponse])
async def users(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AdminUserResponse]:
    return [
        AdminUserResponse.model_validate(record, from_attributes=True)
        for record in await service.users()
    ]


@router.put(
    "/api/admin/users/{user_id}/status",
    response_model=AdminUserResponse,
    dependencies=[Depends(require_csrf)],
)
async def set_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserResponse:
    return AdminUserResponse.model_validate(
        await service.set_user_status(user_id, payload.status), from_attributes=True
    )


@router.post(
    "/api/admin/users/{user_id}/revoke-sessions",
    dependencies=[Depends(require_csrf)],
)
async def revoke_sessions(
    user_id: UUID,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> dict[str, int]:
    return {"revoked_sessions": await service.revoke_sessions(user_id)}


@router.get("/api/admin/organizations", response_model=list[AdminOrganizationResponse])
async def organizations(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AdminOrganizationResponse]:
    return [
        AdminOrganizationResponse.model_validate(record, from_attributes=True)
        for record in await service.organizations()
    ]


@router.get("/api/admin/workspaces", response_model=list[AdminWorkspaceResponse])
async def workspaces(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AdminWorkspaceResponse]:
    return [
        AdminWorkspaceResponse.model_validate(record, from_attributes=True)
        for record in await service.workspaces()
    ]


@router.post("/api/admin/ownership", status_code=204, dependencies=[Depends(require_csrf)])
async def grant_ownership(
    payload: OwnershipGrant,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> None:
    await service.grant_ownership(payload.scope, payload.resource_id, payload.user_id)


@router.get("/api/admin/jobs", response_model=list[AdminJobResponse])
async def jobs(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AdminJobResponse]:
    return [
        AdminJobResponse.model_validate(record, from_attributes=True)
        for record in await service.jobs()
    ]


@router.post(
    "/api/admin/jobs/{job_id}/cancel",
    response_model=AdminJobResponse,
    dependencies=[Depends(require_csrf)],
)
async def cancel_job(
    job_id: UUID,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminJobResponse:
    return AdminJobResponse.model_validate(await service.cancel_job(job_id), from_attributes=True)


@router.post(
    "/api/admin/jobs/{job_id}/retry",
    response_model=AdminJobResponse,
    status_code=202,
    dependencies=[Depends(require_csrf)],
)
async def retry_job(
    job_id: UUID,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminJobResponse:
    return AdminJobResponse.model_validate(await service.retry_job(job_id), from_attributes=True)


@router.get("/api/admin/integrations", response_model=list[AdminIntegrationResponse])
async def integrations(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AdminIntegrationResponse]:
    return [
        AdminIntegrationResponse.model_validate(record, from_attributes=True)
        for record in await service.integrations()
    ]


@router.delete(
    "/api/admin/integrations/{connection_id}",
    response_model=AdminIntegrationResponse,
    dependencies=[Depends(require_csrf)],
)
async def disconnect_integration(
    connection_id: UUID,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminIntegrationResponse:
    return AdminIntegrationResponse.model_validate(
        await service.disconnect_integration(connection_id), from_attributes=True
    )


@router.get("/api/admin/feature-flags", response_model=list[FeatureFlagResponse])
async def flags(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[FeatureFlagResponse]:
    return [
        FeatureFlagResponse.model_validate(record, from_attributes=True)
        for record in await service.flags()
    ]


@router.put(
    "/api/admin/feature-flags/{key}",
    response_model=FeatureFlagResponse,
    dependencies=[Depends(require_csrf)],
)
async def set_flag(
    key: str,
    payload: FeatureFlagUpdate,
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> FeatureFlagResponse:
    if not key or len(key) > 120:
        raise HTTPException(status_code=400, detail="Invalid feature flag key")
    record = await service.set_flag(key, payload.is_enabled, payload.description, payload.rules)
    return FeatureFlagResponse.model_validate(record, from_attributes=True)


@router.get("/api/admin/runtime", response_model=RuntimeInfoResponse)
async def runtime_info(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> RuntimeInfoResponse:
    return RuntimeInfoResponse(**await service.runtime_info())


@router.get("/api/admin/audit", response_model=list[AuditEventResponse])
async def audit_events(
    service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AuditEventResponse]:
    return [
        AuditEventResponse.model_validate(record, from_attributes=True)
        for record in await service.audit_events()
    ]
