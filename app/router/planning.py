"""Authenticated development-plan API, separate from scheduled background jobs."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.planning.repository import PlanningRepository
from app.modules.planning.schemas import ItemCreate, ItemResponse, ItemUpdate, SettingsWrite
from app.modules.planning.service import PlanningService

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/plan",
    tags=["development planning"],
)
ReadContext = Annotated[AuthorizedContext, Depends(require_permission("planning.read"))]
WriteContext = Annotated[AuthorizedContext, Depends(require_permission("planning.update"))]
CreateContext = Annotated[AuthorizedContext, Depends(require_permission("planning.create"))]
DeleteContext = Annotated[AuthorizedContext, Depends(require_permission("planning.delete"))]
ImportContext = Annotated[AuthorizedContext, Depends(require_permission("planning.import"))]


def get_planning_service(session: Annotated[AsyncSession, Depends(get_session)]):
    return PlanningService(PlanningRepository(session))


Service = Annotated[PlanningService, Depends(get_planning_service)]


@router.get("")
async def list_plan(context: ReadContext, service: Service):
    return await service.list(context)


@router.post(
    "/items", response_model=ItemResponse, status_code=201, dependencies=[Depends(require_csrf)]
)
async def create_item(payload: ItemCreate, context: CreateContext, service: Service):
    return await service.create(context, payload)


@router.put("/items/{item_id}", response_model=ItemResponse, dependencies=[Depends(require_csrf)])
async def update_item(item_id: UUID, payload: ItemUpdate, context: WriteContext, service: Service):
    return await service.update(context, item_id, payload)


@router.delete("/items/{item_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def delete_item(
    item_id: UUID, context: DeleteContext, service: Service, revision: Annotated[int, Query(ge=1)]
):
    await service.delete(context, item_id, revision)
    return Response(status_code=204)


@router.put("/settings", dependencies=[Depends(require_csrf)])
async def update_settings(payload: SettingsWrite, context: WriteContext, service: Service):
    return await service.update_settings(context, payload)


# Both browser and MCP adapters use the same owner-side import service.
from app.modules.planning.import_schemas import ImportApply, ImportProposal
from app.modules.planning.import_service import PlanningImportService


@router.get("/imports")
async def list_imports(context: ReadContext, service: Service):
    return await PlanningImportService(service.repository.session, context).list()


@router.get("/imports/{import_id}")
async def read_import(import_id: UUID, context: ReadContext, service: Service):
    imports = PlanningImportService(service.repository.session, context)
    return imports.response(await imports.get(import_id))


@router.post("/imports", dependencies=[Depends(require_csrf)])
async def preview_import(payload: ImportProposal, context: ImportContext, service: Service):
    return await PlanningImportService(service.repository.session, context).preview(payload)


@router.post("/imports/{import_id}/apply", dependencies=[Depends(require_csrf)])
async def apply_import(
    import_id: UUID, payload: ImportApply, context: ImportContext, service: Service
):
    return await PlanningImportService(service.repository.session, context).apply(
        import_id, payload
    )
