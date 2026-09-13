from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any, NoReturn
from uuid import UUID

from agent_factory_core.executions.planning.domain import (
    PlanItem,
    PlanItemDraft,
    PlanKind,
    PlanStatus,
)
from agent_factory_core.executions.planning.use_cases import PlanningUseCases
from agent_factory_core.identity.authorization import AuthorizedContext
from agent_factory_core.shared.errors import ApplicationError
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    kind: PlanKind
    parent_id: UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=20_000)
    acceptance: str = Field(default="", max_length=10_000)
    assignee: str = Field(default="", max_length=160)
    status: PlanStatus = PlanStatus.PENDING
    blocked_reason: str = Field(default="", max_length=2_000)
    start_date: date | None = None
    target_date: date | None = None
    expected_revision: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def dates(self) -> ItemRequest:
        if self.start_date and self.target_date and self.start_date > self.target_date:
            raise ValueError("start_date cannot follow target_date")
        return self

    def draft(self) -> PlanItemDraft:
        return PlanItemDraft(
            self.kind,
            self.name,
            self.parent_id,
            self.description,
            self.acceptance,
            self.assignee,
            self.status,
            self.blocked_reason,
            self.start_date,
            self.target_date,
        )


class SettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    launch_date: date | None
    expected_revision: int = Field(ge=0)


def present(item: PlanItem) -> dict[str, object]:
    result = {name: getattr(item, name) for name in item.__dataclass_fields__}
    result["id"], result["workspace_id"] = item.id.hex, item.workspace_id.hex
    result["parent_id"] = item.parent_id.hex if item.parent_id else None
    result["kind"], result["status"] = item.kind.value, item.status.value
    return result


def _raise(error: ApplicationError) -> NoReturn:
    raise HTTPException(
        error.status_code, detail={"code": error.code, "message": error.message, **error.details}
    ) from error


def create_planning_router(
    service_dependency: Callable[..., PlanningUseCases],
    context_dependency: Callable[..., AuthorizedContext],
    csrf_dependency: Callable[..., None],
    import_dependency: Callable[..., Any] | None = None,
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/plan",
        tags=["planning"],
    )
    service_dep, context_dep = Depends(service_dependency), Depends(context_dependency)
    imports_dep = Depends(import_dependency) if import_dependency is not None else None

    @router.get("")
    async def dashboard(
        service: PlanningUseCases = service_dep, context: AuthorizedContext = context_dep
    ) -> dict[str, object]:
        try:
            return await service.dashboard(context)
        except ApplicationError as error:
            _raise(error)

    @router.post(
        "/items", status_code=status.HTTP_201_CREATED, dependencies=[Depends(csrf_dependency)]
    )
    async def create(
        payload: ItemRequest,
        service: PlanningUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            return present(await service.create(context, payload.draft()))
        except ApplicationError as error:
            _raise(error)

    @router.put("/items/{item_id}", dependencies=[Depends(csrf_dependency)])
    async def update(
        item_id: UUID,
        payload: ItemRequest,
        service: PlanningUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        if payload.expected_revision is None:
            raise HTTPException(422, detail={"code": "revision_required"})
        try:
            return present(
                await service.update(context, item_id, payload.draft(), payload.expected_revision)
            )
        except ApplicationError as error:
            _raise(error)

    @router.delete(
        "/items/{item_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(csrf_dependency)],
    )
    async def delete(
        item_id: UUID,
        revision: int = Query(ge=1),
        service: PlanningUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> Response:
        try:
            await service.delete(context, item_id, revision)
        except ApplicationError as error:
            _raise(error)
        return Response(status_code=204)

    @router.put("/settings", dependencies=[Depends(csrf_dependency)])
    async def settings(
        payload: SettingsRequest,
        service: PlanningUseCases = service_dep,
        context: AuthorizedContext = context_dep,
    ) -> dict[str, object]:
        try:
            result = await service.save_settings(
                context, payload.launch_date, payload.expected_revision
            )
            return {"launch_date": result.launch_date, "revision": result.revision}
        except ApplicationError as error:
            _raise(error)

    if imports_dep is not None:

        @router.get("/imports")
        async def list_imports(
            imports: Any = imports_dep, context: AuthorizedContext = context_dep
        ) -> list[dict[str, object]]:
            try:
                return await imports.list(context)
            except ApplicationError as error:
                _raise(error)

        @router.get("/imports/{import_id}")
        async def read_import(
            import_id: UUID,
            imports: Any = imports_dep,
            context: AuthorizedContext = context_dep,
        ) -> dict[str, object]:
            try:
                return await imports.read(context, import_id)
            except ApplicationError as error:
                _raise(error)

        @router.post("/imports", dependencies=[Depends(csrf_dependency)])
        async def preview_import(
            payload: dict[str, object],
            imports: Any = imports_dep,
            context: AuthorizedContext = context_dep,
        ) -> dict[str, object]:
            try:
                return await imports.preview(context, payload)
            except ApplicationError as error:
                _raise(error)

        @router.post("/imports/{import_id}/apply", dependencies=[Depends(csrf_dependency)])
        async def apply_import(
            import_id: UUID,
            payload: dict[str, object],
            imports: Any = imports_dep,
            context: AuthorizedContext = context_dep,
        ) -> dict[str, object]:
            try:
                digest = payload.get("preview_digest")
                if not isinstance(digest, str) or len(digest) != 64:
                    raise ApplicationError(
                        "invalid_preview_digest", "Preview digest is invalid", 422
                    )
                return await imports.apply(
                    context,
                    import_id,
                    digest,
                    bool(payload.get("acknowledge_warnings", False)),
                )
            except ApplicationError as error:
                _raise(error)

    return router
