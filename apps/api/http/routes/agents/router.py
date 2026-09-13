from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

from agent_factory_core.executions.agents.domain import AgentStatus
from agent_factory_core.executions.agents.use_cases import AgentUseCases
from agent_factory_core.shared.errors import ApplicationError
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field


class Context(Protocol):
    principal: Any
    scope: Any
    permissions: frozenset[str]


class DefinitionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z][a-z0-9-]{0,119}$")
    description: str = Field(default="", max_length=10000)


class DefinitionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    status: AgentStatus
    expected_revision: int = Field(ge=1)


class VersionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    instructions: str = Field(min_length=1, max_length=100000)
    model: str = Field(min_length=1, max_length=200)
    configuration: dict[str, object] = Field(default_factory=dict)
    allowed_tools: list[str] = Field(default_factory=list, max_length=500)


class RunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version_id: UUID | None = None
    idempotency_key: str = Field(min_length=1, max_length=160)
    input_payload: dict[str, object] = Field(default_factory=dict)


def present(value: object) -> dict[str, object]:
    def scalar(item: object) -> object:
        if isinstance(item, UUID):
            return str(item)
        if isinstance(item, datetime):
            return item.isoformat()
        if hasattr(item, "value"):
            return item.value
        if isinstance(item, tuple):
            return [
                present(value) if hasattr(value, "__dataclass_fields__") else scalar(value)
                for value in item
            ]
        if hasattr(item, "__dataclass_fields__"):
            return present(item)
        return item

    return {name: scalar(getattr(value, name)) for name in value.__dataclass_fields__}  # type: ignore[attr-defined]


def create_agents_router(
    service_dependency: Callable[..., AgentUseCases],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}", tags=["agents"]
    )
    service, context = Depends(service_dependency), Depends(context_dependency)

    def fail(error: ApplicationError):
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": error.message}
        ) from error

    @router.get("/agents")
    async def definitions(s: AgentUseCases = service, c: Context = context):
        try:
            return [present(row) for row in await s.definitions(c)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/agents", status_code=status.HTTP_201_CREATED, dependencies=[Depends(csrf_dependency)]
    )
    async def create(payload: DefinitionCreate, s: AgentUseCases = service, c: Context = context):
        try:
            return present(await s.create_definition(c, **payload.model_dump()))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.put("/agents/{definition_id}", dependencies=[Depends(csrf_dependency)])
    async def update(
        definition_id: UUID,
        payload: DefinitionUpdate,
        s: AgentUseCases = service,
        c: Context = context,
    ):
        try:
            return present(await s.update_definition(c, definition_id, **payload.model_dump()))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.delete("/agents/{definition_id}", dependencies=[Depends(csrf_dependency)])
    async def delete(
        definition_id: UUID,
        expected_revision: int = Query(ge=1),
        s: AgentUseCases = service,
        c: Context = context,
    ):
        try:
            await s.delete_definition(c, definition_id, expected_revision=expected_revision)  # type: ignore[arg-type]
            return Response(status_code=204)
        except ApplicationError as error:
            fail(error)

    @router.get("/agents/{definition_id}/versions")
    async def versions(definition_id: UUID, s: AgentUseCases = service, c: Context = context):
        try:
            return [present(row) for row in await s.versions(c, definition_id)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/agents/{definition_id}/versions",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def version(
        definition_id: UUID,
        payload: VersionCreate,
        s: AgentUseCases = service,
        c: Context = context,
    ):
        try:
            return present(await s.create_version(c, definition_id, **payload.model_dump()))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/agent-runs")
    async def runs(s: AgentUseCases = service, c: Context = context):
        try:
            return [present(row) for row in await s.runs(c)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/agents/{definition_id}/runs",
        status_code=status.HTTP_202_ACCEPTED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def submit(
        definition_id: UUID, payload: RunCreate, s: AgentUseCases = service, c: Context = context
    ):
        try:
            return present(await s.submit(c, definition_id, **payload.model_dump()))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/agent-runs/{run_id}/events")
    async def events(run_id: UUID, s: AgentUseCases = service, c: Context = context):
        try:
            return [present(row) for row in await s.events(c, run_id)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/agent-runs/{run_id}/evidence")
    async def evidence(run_id: UUID, s: AgentUseCases = service, c: Context = context):
        try:
            return present(await s.evidence(c, run_id))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post("/agent-runs/{run_id}/cancel", dependencies=[Depends(csrf_dependency)])
    async def cancel(run_id: UUID, s: AgentUseCases = service, c: Context = context):
        try:
            return present(await s.cancel(c, run_id))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/agent-runs/{run_id}/retry",
        status_code=status.HTTP_202_ACCEPTED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def retry(run_id: UUID, s: AgentUseCases = service, c: Context = context):
        try:
            return present(await s.retry(c, run_id))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    return router
