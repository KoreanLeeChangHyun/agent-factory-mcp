from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol
from uuid import UUID

from agent_factory_core.executions.reporting.domain import SearchRequest
from agent_factory_core.executions.reporting.use_cases import ReportingUseCases
from agent_factory_core.shared.errors import ApplicationError
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field


class Context(Protocol):
    principal: Any
    scope: Any
    permissions: frozenset[str]


class SearchQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    query: str = Field(min_length=1, max_length=256)
    kind: str
    limit: int = Field(default=20, ge=1, le=100)
    after_id: UUID | None = None


def create_reporting_router(
    service_dependency: Callable[..., ReportingUseCases], context_dependency: Callable[..., Context]
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/reporting",
        tags=["reporting"],
    )
    service, context = Depends(service_dependency), Depends(context_dependency)

    def fail(error: ApplicationError):
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": error.message}
        ) from error

    @router.get("")
    async def snapshot(s: ReportingUseCases = service, c: Context = context):
        try:
            return await s.snapshot(c)  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/tasks/{task_id}")
    async def detail(
        task_id: UUID,
        before_revision: int | None = Query(default=None, ge=1),
        s: ReportingUseCases = service,
        c: Context = context,
    ):
        try:
            return await s.detail(c, task_id, before_revision)  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post("/search")
    async def search(payload: SearchQuery, s: ReportingUseCases = service, c: Context = context):
        try:
            return await s.search(c, SearchRequest(**payload.model_dump()))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    return router
