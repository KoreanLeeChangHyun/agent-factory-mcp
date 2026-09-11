"""Versioned Agent definitions and execution records API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.agent.execution_service import AgentExecutionService
from app.modules.agent.factory import agent_execution_service
from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import (
    AgentDefinitionCreate,
    AgentDefinitionResponse,
    AgentDefinitionUpdate,
    AgentRunCreate,
    AgentRunEventResponse,
    AgentRunResponse,
    AgentVersionCreate,
    AgentVersionResponse,
)
from app.modules.agent.service import AgentService
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/agents",
    tags=["agents"],
)


def get_agent_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AgentService:
    return AgentService(AgentRepository(session))


def get_agent_execution_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AgentExecutionService:
    return agent_execution_service(session)


def _definition_response(record: object) -> AgentDefinitionResponse:
    return AgentDefinitionResponse.model_validate(record, from_attributes=True)


def _run_response(record: object) -> AgentRunResponse:
    return AgentRunResponse.model_validate(record, from_attributes=True)


@router.get("/definitions", response_model=list[AgentDefinitionResponse])
async def list_definitions(
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.read"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> list[AgentDefinitionResponse]:
    return [_definition_response(record) for record in await service.list_definitions(context)]


@router.post(
    "/definitions",
    response_model=AgentDefinitionResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_definition(
    payload: AgentDefinitionCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.create"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> AgentDefinitionResponse:
    return _definition_response(
        await service.create_definition(context, payload.name, payload.slug, payload.description)
    )


@router.put(
    "/definitions/{definition_id}",
    response_model=AgentDefinitionResponse,
    dependencies=[Depends(require_csrf)],
)
async def update_definition(
    definition_id: UUID,
    payload: AgentDefinitionUpdate,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.update"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> AgentDefinitionResponse:
    return _definition_response(
        await service.update_definition(
            context,
            definition_id,
            payload.name,
            payload.description,
            payload.status,
            payload.revision,
        )
    )


@router.get("/definitions/{definition_id}/versions", response_model=list[AgentVersionResponse])
async def list_versions(
    definition_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.read"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> list[AgentVersionResponse]:
    return [
        AgentVersionResponse.model_validate(record, from_attributes=True)
        for record in await service.list_versions(context, definition_id)
    ]


@router.post(
    "/definitions/{definition_id}/versions",
    response_model=AgentVersionResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_version(
    definition_id: UUID,
    payload: AgentVersionCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.update"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> AgentVersionResponse:
    record = await service.create_version(
        context,
        definition_id,
        payload.instructions,
        payload.model,
        payload.configuration,
        payload.allowed_tools,
    )
    return AgentVersionResponse.model_validate(record, from_attributes=True)


@router.get("/runs", response_model=list[AgentRunResponse])
async def list_runs(
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.read"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> list[AgentRunResponse]:
    return [_run_response(record) for record in await service.list_runs(context)]


@router.post(
    "/definitions/{definition_id}/runs",
    response_model=AgentRunResponse,
    status_code=202,
    dependencies=[Depends(require_csrf)],
)
async def create_run(
    definition_id: UUID,
    payload: AgentRunCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.execute"))],
    service: Annotated[AgentExecutionService, Depends(get_agent_execution_service)],
) -> AgentRunResponse:
    execution = await service.submit(
        context,
        definition_id,
        payload.agent_version_id,
        payload.idempotency_key,
        payload.input,
    )
    return _run_response(execution.run)


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_run(
    run_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.read"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> AgentRunResponse:
    return _run_response(await service.get_run(context, run_id))


@router.post(
    "/runs/{run_id}/cancel",
    response_model=AgentRunResponse,
    dependencies=[Depends(require_csrf)],
)
async def cancel_run(
    run_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.stop"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> AgentRunResponse:
    return _run_response(await service.cancel_run(context, run_id))


@router.post(
    "/runs/{run_id}/retry",
    response_model=AgentRunResponse,
    status_code=202,
    dependencies=[Depends(require_csrf)],
)
async def retry_run(
    run_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.execute"))],
    service: Annotated[AgentExecutionService, Depends(get_agent_execution_service)],
) -> AgentRunResponse:
    return _run_response((await service.retry(context, run_id)).run)


@router.get("/runs/{run_id}/events", response_model=list[AgentRunEventResponse])
async def list_run_events(
    run_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.read"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> list[AgentRunEventResponse]:
    return [
        AgentRunEventResponse.model_validate(record, from_attributes=True)
        for record in await service.list_events(context, run_id)
    ]


@router.delete(
    "/definitions/{definition_id}", status_code=204, dependencies=[Depends(require_csrf)]
)
async def delete_definition(
    definition_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("agent.delete"))],
    service: Annotated[AgentService, Depends(get_agent_service)],
):
    await service.delete_definition(context, definition_id)
