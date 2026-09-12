from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Any, NoReturn, Protocol
from uuid import UUID

from agent_factory_core import (
    WorkbenchActor,
    WorkbenchConflictError,
    WorkbenchDefinitionAggregate,
    WorkbenchError,
    WorkbenchIdempotencyError,
    WorkbenchNotFoundError,
    WorkbenchPermissionError,
    WorkbenchRelease,
    WorkbenchValidationError,
)
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field


class WorkbenchContext(Protocol):
    principal: Any
    scope: Any
    permissions: frozenset[str]


@dataclass(frozen=True, slots=True)
class WorkbenchService:
    list_definitions: Any
    get_definition: Any
    create: Any
    update: Any
    archive: Any
    publish: Any
    list_releases: Any
    get_release: Any


class CreateDefinitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")
    title: str = Field(min_length=1, max_length=200)
    definition: dict[str, object]


class UpdateDefinitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    expectedRevision: int = Field(ge=1, le=2_147_483_646)
    definition: dict[str, object]


class RevisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expectedRevision: int = Field(ge=1, le=2_147_483_646)


class PublishRequest(RevisionRequest):
    requestKey: str = Field(min_length=1, max_length=160)


def _actor(context: WorkbenchContext) -> WorkbenchActor:
    return WorkbenchActor(
        context.principal.user_id,
        context.scope.organization_id,
        context.scope.workspace_id,
        context.permissions,
    )


def present_definition(
    item: WorkbenchDefinitionAggregate, *, include_draft: bool = False
) -> dict[str, object]:
    result: dict[str, object] = {
        "id": item.id.hex,
        "organizationId": item.organization_id.hex,
        "workspaceId": item.workspace_id.hex,
        "key": item.key,
        "title": item.title,
        "state": item.state.value,
        "revision": item.revision,
        "latestReleaseId": item.latest_release_id.hex if item.latest_release_id else None,
        "createdBy": item.created_by.hex,
        "updatedBy": item.updated_by.hex,
        "createdAt": item.created_at.isoformat(),
        "updatedAt": item.updated_at.isoformat(),
        "archivedAt": item.archived_at.isoformat() if item.archived_at else None,
    }
    if include_draft:
        result["definition"] = dict(item.draft)
    return result


def present_release(item: WorkbenchRelease) -> dict[str, object]:
    return {
        "id": item.id.hex,
        "organizationId": item.organization_id.hex,
        "workspaceId": item.workspace_id.hex,
        "definitionId": item.definition_id.hex,
        "definitionRevision": item.definition_revision,
        "releaseNumber": item.release_number,
        "schemaVersion": item.schema_version,
        "schemaDigest": item.schema_digest,
        "assetVersion": item.asset_version,
        "definitionDigest": item.definition_digest,
        "definition": dict(item.snapshot),
        "publishedBy": item.published_by.hex,
        "publishedAt": item.published_at.isoformat(),
    }


def _raise(error: WorkbenchError) -> NoReturn:
    if isinstance(error, WorkbenchValidationError):
        raise HTTPException(
            422, detail={"code": error.code, "diagnostics": list(error.diagnostics)}
        ) from error
    if isinstance(error, WorkbenchConflictError):
        raise HTTPException(
            409, detail={"code": error.code, "currentRevision": error.current_revision}
        ) from error
    if isinstance(error, WorkbenchIdempotencyError):
        raise HTTPException(
            409, detail={"code": error.code, "requestKey": error.request_key}
        ) from error
    if isinstance(error, WorkbenchPermissionError):
        raise HTTPException(403, detail={"code": error.code}) from error
    if isinstance(error, WorkbenchNotFoundError):
        raise HTTPException(404, detail={"code": error.code}) from error
    raise HTTPException(409, detail={"code": error.code}) from error


def create_workbench_router(
    service_dependency: Callable[..., WorkbenchService],
    context_dependency: Callable[..., WorkbenchContext],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(prefix="/api/workspaces/{workspace_id}/workbenches", tags=["workbenches"])
    context_dep = Depends(context_dependency)
    service_dep = Depends(service_dependency)

    @router.get("")
    async def list_definitions(
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
        include_archived: Annotated[bool, Query(alias="includeArchived")] = False,
    ) -> dict[str, object]:
        actor = _actor(context)
        try:
            rows = await service.list_definitions.execute(actor, include_archived=include_archived)
        except WorkbenchError as error:
            _raise(error)
        return {
            "items": [present_definition(row) for row in rows],
            "permissions": sorted(
                permission
                for permission in actor.permissions
                if permission.startswith("workbench.")
            ),
        }

    @router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(csrf_dependency)])
    async def create_definition(
        payload: CreateDefinitionRequest,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return present_definition(
                await service.create.execute(
                    _actor(context),
                    key=payload.key,
                    title=payload.title,
                    definition=payload.definition,
                ),
                include_draft=True,
            )
        except WorkbenchError as error:
            _raise(error)

    @router.get("/{definition_id}/draft")
    async def get_draft(
        definition_id: UUID,
        response: Response,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        response.headers["Cache-Control"] = "no-store"
        try:
            return present_definition(
                await service.get_definition.execute(_actor(context), definition_id, preview=True),
                include_draft=True,
            )
        except WorkbenchError as error:
            _raise(error)

    @router.put("/{definition_id}/draft", dependencies=[Depends(csrf_dependency)])
    async def update_draft(
        definition_id: UUID,
        payload: UpdateDefinitionRequest,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return present_definition(
                await service.update.execute(
                    _actor(context),
                    definition_id,
                    title=payload.title,
                    definition=payload.definition,
                    expected_revision=payload.expectedRevision,
                ),
                include_draft=True,
            )
        except WorkbenchError as error:
            _raise(error)

    @router.post(
        "/{definition_id}/publish",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def publish(
        definition_id: UUID,
        payload: PublishRequest,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return present_release(
                await service.publish.execute(
                    _actor(context),
                    definition_id,
                    expected_revision=payload.expectedRevision,
                    request_key=payload.requestKey,
                )
            )
        except WorkbenchError as error:
            _raise(error)

    @router.post("/{definition_id}/archive", dependencies=[Depends(csrf_dependency)])
    async def archive(
        definition_id: UUID,
        payload: RevisionRequest,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return present_definition(
                await service.archive.execute(
                    _actor(context),
                    definition_id,
                    archived=True,
                    expected_revision=payload.expectedRevision,
                )
            )
        except WorkbenchError as error:
            _raise(error)

    @router.post("/{definition_id}/restore", dependencies=[Depends(csrf_dependency)])
    async def restore(
        definition_id: UUID,
        payload: RevisionRequest,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return present_definition(
                await service.archive.execute(
                    _actor(context),
                    definition_id,
                    archived=False,
                    expected_revision=payload.expectedRevision,
                )
            )
        except WorkbenchError as error:
            _raise(error)

    @router.get("/{definition_id}/releases")
    async def list_releases(
        definition_id: UUID,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return {
                "items": [
                    present_release(row)
                    for row in await service.list_releases.execute(_actor(context), definition_id)
                ]
            }
        except WorkbenchError as error:
            _raise(error)

    @router.get("/releases/{release_id}")
    async def get_release(
        release_id: UUID,
        context: WorkbenchContext = context_dep,
        service: WorkbenchService = service_dep,
    ) -> dict[str, object]:
        try:
            return present_release(await service.get_release.execute(_actor(context), release_id))
        except WorkbenchError as error:
            _raise(error)

    return router
