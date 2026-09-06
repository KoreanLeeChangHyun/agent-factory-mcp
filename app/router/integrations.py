"""External integration catalog, tenant connection, and webhook API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.secret_encryption import SecretCipher
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.integration.repository import IntegrationRepository
from app.modules.integration.schemas import (
    ConnectionCreate,
    ConnectionResponse,
    CursorUpdate,
    OAuthBeginResponse,
    ProviderResponse,
    WebhookEndpointCreated,
)
from app.modules.integration.service import IntegrationService

router = APIRouter(tags=["integrations"])


def get_integration_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IntegrationService:
    cipher = SecretCipher(
        settings.integration_encryption_key.get_secret_value(),
        settings.integration_encryption_key_version,
    )
    return IntegrationService(IntegrationRepository(session), cipher, settings)


@router.get("/api/integration-providers", response_model=list[ProviderResponse])
async def list_providers(
    context: Annotated[
        AuthorizedContext,
        Depends(require_permission("integration.read")),
    ],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> list[ProviderResponse]:
    del context
    return [
        ProviderResponse.model_validate(record, from_attributes=True)
        for record in await service.list_providers()
    ]


@router.get(
    "/api/organizations/{organization_id}/workspaces/{workspace_id}/integrations",
    response_model=list[ConnectionResponse],
)
async def list_connections(
    context: Annotated[AuthorizedContext, Depends(require_permission("integration.read"))],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> list[ConnectionResponse]:
    return [
        ConnectionResponse.model_validate(record, from_attributes=True)
        for record in await service.list_connections(context)
    ]


@router.post(
    "/api/organizations/{organization_id}/workspaces/{workspace_id}/integrations",
    response_model=ConnectionResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_connection(
    payload: ConnectionCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("integration.create"))],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> ConnectionResponse:
    record = await service.create_connection(
        context, payload.provider_id, payload.name, payload.credentials
    )
    return ConnectionResponse.model_validate(record, from_attributes=True)


@router.delete(
    "/api/organizations/{organization_id}/workspaces/{workspace_id}/integrations/{connection_id}",
    status_code=204,
    dependencies=[Depends(require_csrf)],
)
async def disconnect(
    connection_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("integration.delete"))],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> None:
    await service.disconnect(context, connection_id)


@router.put(
    "/api/organizations/{organization_id}/workspaces/{workspace_id}/integrations/{connection_id}/cursor",
    status_code=204,
    dependencies=[Depends(require_csrf)],
)
async def update_cursor(
    connection_id: UUID,
    payload: CursorUpdate,
    context: Annotated[AuthorizedContext, Depends(require_permission("integration.update"))],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> None:
    await service.update_cursor(context, connection_id, payload.cursor)


@router.post(
    "/api/organizations/{organization_id}/workspaces/{workspace_id}/integrations/oauth/{provider_id}/begin",
    response_model=OAuthBeginResponse,
    dependencies=[Depends(require_csrf)],
)
async def begin_oauth(
    provider_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("integration.create"))],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> OAuthBeginResponse:
    state, challenge, expires_at = await service.begin_oauth(context, provider_id)
    return OAuthBeginResponse(state=state, code_challenge=challenge, expires_at=expires_at)


@router.post(
    "/api/organizations/{organization_id}/workspaces/{workspace_id}/integrations/{connection_id}/webhook",
    response_model=WebhookEndpointCreated,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_webhook_endpoint(
    connection_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("integration.update"))],
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> WebhookEndpointCreated:
    public_id, signing_secret, url = await service.create_webhook_endpoint(context, connection_id)
    return WebhookEndpointCreated(public_id=public_id, signing_secret=signing_secret, url=url)


@router.post("/api/webhooks/{public_id}", status_code=202)
async def receive_webhook(
    public_id: str,
    request: Request,
    service: Annotated[IntegrationService, Depends(get_integration_service)],
    event_id: Annotated[str, Header(alias="X-Event-ID", min_length=1, max_length=500)],
    signature: Annotated[str, Header(alias="X-Signature", min_length=1, max_length=500)],
) -> dict[str, str]:
    delivery = await service.accept_webhook(public_id, event_id, await request.body(), signature)
    return {"delivery_id": str(delivery.id), "status": delivery.status.value}
