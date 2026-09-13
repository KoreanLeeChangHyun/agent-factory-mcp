from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any, NoReturn, Protocol
from uuid import UUID

from agent_factory_core.connections.mcp.configuration import MCPConfigurationUseCases
from agent_factory_core.connections.mcp.use_cases import MCPConnectionUseCases
from agent_factory_core.connections.providers.collection_domain import (
    CollectionMode,
    CollectionSelection,
)
from agent_factory_core.connections.providers.collection_use_cases import ProviderCollectionUseCases
from agent_factory_core.connections.providers.credentials import (
    ProviderCredentialUseCases,
    ProviderOAuthCallbackUseCases,
)
from agent_factory_core.connections.providers.use_cases import ProviderConnectionUseCases
from agent_factory_core.connections.providers.webhooks import ProviderWebhookUseCases
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ApplicationError
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, Field


class Context(Protocol):
    principal: Any
    scope: Any
    permissions: frozenset[str]


class ProviderConnectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    provider_id: UUID
    name: str = Field(min_length=1, max_length=160)


class MCPConnectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)


class ProviderTokenSet(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=10_000)
    approved_scopes: list[str] = Field(default_factory=list, max_length=10)


class OAuthBegin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scopes: list[str] = Field(default_factory=list, max_length=10)


class CollectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    connection_id: UUID
    name: str = Field(min_length=1, max_length=160)
    selection: dict[str, object]
    mode: CollectionMode = CollectionMode.CONTENT


class CollectionStart(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    request_key: str = Field(min_length=1, max_length=160)


class CollectionEnabled(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


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


def create_connections_router(
    provider_dependency: Callable[..., ProviderConnectionUseCases],
    credential_dependency: Callable[..., ProviderCredentialUseCases],
    mcp_dependency: Callable[..., MCPConnectionUseCases],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}",
        tags=["connections"],
    )
    providers, credentials, mcp, context = (
        Depends(provider_dependency),
        Depends(credential_dependency),
        Depends(mcp_dependency),
        Depends(context_dependency),
    )

    def fail(error: ApplicationError) -> NoReturn:
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": error.message}
        ) from error

    @router.get("/providers")
    async def catalog(s: ProviderConnectionUseCases = providers, c: Context = context):
        try:
            return [present(row) for row in await s.catalog(c)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/provider-connections")
    async def provider_connections(s: ProviderConnectionUseCases = providers, c: Context = context):
        try:
            return [present(row) for row in await s.connections(c)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/provider-connections",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def create_provider(
        payload: ProviderConnectionCreate,
        s: ProviderConnectionUseCases = providers,
        c: Context = context,
    ):
        try:
            return present(await s.create(c, payload.provider_id, name=payload.name))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.delete("/provider-connections/{connection_id}", dependencies=[Depends(csrf_dependency)])
    async def disconnect_provider(
        connection_id: UUID, s: ProviderConnectionUseCases = providers, c: Context = context
    ):
        try:
            return present(await s.disconnect(c, connection_id))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.put(
        "/provider-connections/{connection_id}/token",
        dependencies=[Depends(csrf_dependency)],
    )
    async def set_provider_token(
        connection_id: UUID,
        payload: ProviderTokenSet,
        response: Response,
        s: ProviderCredentialUseCases = credentials,
        c: Context = context,
    ):
        response.headers["Cache-Control"] = "no-store"
        try:
            return await s.set_token(  # type: ignore[arg-type]
                c, connection_id, token=payload.token, approved_scopes=payload.approved_scopes
            )
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/provider-connections/{connection_id}/oauth/start",
        dependencies=[Depends(csrf_dependency)],
    )
    async def begin_oauth(
        connection_id: UUID,
        payload: OAuthBegin,
        response: Response,
        s: ProviderCredentialUseCases = credentials,
        c: Context = context,
    ):
        response.headers["Cache-Control"] = "no-store"
        try:
            return present(await s.begin(c, connection_id, payload.scopes))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/mcp-connections")
    async def mcp_connections(
        response: Response, s: MCPConnectionUseCases = mcp, c: Context = context
    ):
        response.headers["Cache-Control"] = "no-store"
        try:
            connections = [present(row) for row in await s.status(c)]  # type: ignore[arg-type]
            aggregate = (
                "verified"
                if any(row["state"] == "verified" for row in connections)
                else "pending"
                if not connections or any(row["state"] == "pending" for row in connections)
                else "reauth_required"
            )
            return {"state": aggregate, "connections": connections}
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/mcp-connections",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(csrf_dependency)],
    )
    async def issue(
        payload: MCPConnectionCreate,
        response: Response,
        s: MCPConnectionUseCases = mcp,
        c: Context = context,
    ):
        response.headers["Cache-Control"] = "no-store"
        try:
            result = await s.issue(c, payload.name)  # type: ignore[arg-type]
            return {"connection": present(result.connection), "token": result.plaintext_token}
        except ApplicationError as error:
            fail(error)

    @router.post("/mcp-connections/{connection_id}/secret", dependencies=[Depends(csrf_dependency)])
    async def secret(
        connection_id: UUID,
        response: Response,
        s: MCPConnectionUseCases = mcp,
        c: Context = context,
    ):
        response.headers["Cache-Control"] = "no-store"
        try:
            return {"id": str(connection_id), "token": await s.reveal(c, connection_id)}  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.delete("/mcp-connections/{connection_id}", dependencies=[Depends(csrf_dependency)])
    async def revoke(connection_id: UUID, s: MCPConnectionUseCases = mcp, c: Context = context):
        try:
            await s.revoke(c, connection_id)
            return Response(status_code=204)  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.delete(
        "/mcp-connections/{connection_id}/purge", dependencies=[Depends(csrf_dependency)]
    )
    async def purge(connection_id: UUID, s: MCPConnectionUseCases = mcp, c: Context = context):
        try:
            await s.purge(c, connection_id)
            return Response(status_code=204)  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    return router


def create_mcp_configuration_router(
    configuration_dependency: Callable[..., MCPConfigurationUseCases],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/mcp-connections",
        tags=["connections"],
    )
    configuration_service, context = Depends(configuration_dependency), Depends(context_dependency)

    def fail(error: ApplicationError) -> NoReturn:
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": error.message}
        ) from error

    @router.get("/{connection_id}/instructions")
    async def instructions(
        connection_id: UUID,
        s: MCPConfigurationUseCases = configuration_service,
        c: Context = context,
    ):
        try:
            return await s.describe(c, connection_id)  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post("/{connection_id}/configuration", dependencies=[Depends(csrf_dependency)])
    async def configuration(
        connection_id: UUID,
        s: MCPConfigurationUseCases = configuration_service,
        c: Context = context,
    ):
        try:
            result = await s.bundle(c, connection_id)  # type: ignore[arg-type]
            return Response(
                content=result.body,
                media_type="application/zip",
                headers={
                    "Cache-Control": "no-store",
                    "Content-Disposition": f'attachment; filename="{result.filename}"',
                },
            )
        except ApplicationError as error:
            fail(error)

    return router


def create_provider_oauth_callback_router(
    callback_dependency: Callable[..., ProviderOAuthCallbackUseCases],
    principal_dependency: Callable[..., Principal | None],
    clean_workspace_url: str,
) -> APIRouter:
    router = APIRouter(tags=["connections"])
    callback_service = Depends(callback_dependency)
    principal = Depends(principal_dependency)

    @router.get("/api/integrations/oauth/{provider}/callback")
    async def oauth_callback(
        provider: str,
        state: str = "",
        code: str = "",
        error: str | None = None,
        service: ProviderOAuthCallbackUseCases = callback_service,
        actor: Principal | None = principal,
    ) -> RedirectResponse:
        # Query credentials are never reflected into the redirect target or response body.
        response = RedirectResponse(
            clean_workspace_url,
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
        )
        try:
            if actor is not None:
                await service.handle(
                    actor, provider, state=state, code=code, denied=error is not None
                )
        except Exception:  # noqa: BLE001, S110 - never log or reflect callback query values
            pass
        return response

    return router


def create_provider_collections_router(
    collection_dependency: Callable[..., ProviderCollectionUseCases],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}",
        tags=["connections"],
    )
    service, context = Depends(collection_dependency), Depends(context_dependency)

    def fail(error: ApplicationError) -> NoReturn:
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": error.message}
        ) from error

    @router.get("/provider-collections")
    async def collections(s: ProviderCollectionUseCases = service, c: Context = context):
        try:
            return [present(row) for row in await s.list(c)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post("/provider-collections", status_code=201, dependencies=[Depends(csrf_dependency)])
    async def create_collection(
        payload: CollectionCreate,
        s: ProviderCollectionUseCases = service,
        c: Context = context,
    ):
        bounds = payload.selection
        try:
            selection = CollectionSelection(
                {
                    key: value
                    for key, value in bounds.items()
                    if key not in {"max_items", "max_pages", "max_bytes", "attachments"}
                },
                int(str(bounds.get("max_items", 100))),
                int(str(bounds.get("max_pages", 100))),
                int(str(bounds.get("max_bytes", 50_000_000))),
                bool(bounds.get("attachments", True)),
            )
            return present(
                await s.create(
                    c,
                    payload.connection_id,
                    name=payload.name,
                    selection=selection,
                    mode=payload.mode,
                )
            )  # type: ignore[arg-type]
        except (TypeError, ValueError):
            fail(
                ApplicationError("invalid_collection_bounds", "Collection bounds are invalid", 422)
            )
        except ApplicationError as error:
            fail(error)

    @router.put("/provider-collections/{collection_id}", dependencies=[Depends(csrf_dependency)])
    async def enable_collection(
        collection_id: UUID,
        payload: CollectionEnabled,
        s: ProviderCollectionUseCases = service,
        c: Context = context,
    ):
        try:
            return present(await s.enable(c, collection_id, enabled=payload.enabled))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post(
        "/provider-collections/{collection_id}/runs",
        status_code=202,
        dependencies=[Depends(csrf_dependency)],
    )
    async def start_collection(
        collection_id: UUID,
        payload: CollectionStart,
        s: ProviderCollectionUseCases = service,
        c: Context = context,
    ):
        try:
            return present(await s.start(c, collection_id, payload.request_key))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/provider-collections/runs/{run_id}")
    async def collection_status(
        run_id: UUID, s: ProviderCollectionUseCases = service, c: Context = context
    ):
        try:
            return present(await s.status(c, run_id))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/provider-collections/runs/{run_id}/results")
    async def collection_results(
        run_id: UUID, s: ProviderCollectionUseCases = service, c: Context = context
    ):
        try:
            return [present(row) for row in await s.results(c, run_id)]  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/provider-connections/{connection_id}/inspect")
    async def inspect_connection(
        connection_id: UUID,
        live: bool = False,
        s: ProviderCollectionUseCases = service,
        c: Context = context,
    ):
        try:
            return present(await s.inspect(c, connection_id, live=live))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.get("/provider-connections/{connection_id}/drive-sources")
    async def drive_sources(
        connection_id: UUID,
        folder_id: str,
        cursor: str | None = None,
        limit: int = 100,
        s: ProviderCollectionUseCases = service,
        c: Context = context,
    ):
        try:
            return present(
                await s.browse_drive(
                    c, connection_id, folder_id=folder_id, cursor=cursor, limit=limit
                )
            )  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.delete("/provider-collections/runs/{run_id}", dependencies=[Depends(csrf_dependency)])
    async def cancel_collection(
        run_id: UUID, s: ProviderCollectionUseCases = service, c: Context = context
    ):
        try:
            return present(await s.cancel(c, run_id))  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    return router


def create_provider_webhook_router(
    webhook_dependency: Callable[..., ProviderWebhookUseCases],
    context_dependency: Callable[..., Context],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(tags=["connections"])
    service, context = Depends(webhook_dependency), Depends(context_dependency)

    def fail(error: ApplicationError) -> NoReturn:
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": error.message}
        ) from error

    @router.post(
        "/api/organizations/{organization_id}/workspaces/{workspace_id}/provider-connections/{connection_id}/webhook",
        status_code=201,
        dependencies=[Depends(csrf_dependency)],
    )
    async def create_webhook(
        connection_id: UUID, s: ProviderWebhookUseCases = service, c: Context = context
    ):
        try:
            return await s.create(c, connection_id)  # type: ignore[arg-type]
        except ApplicationError as error:
            fail(error)

    @router.post("/api/webhooks/{public_id}", status_code=202)
    async def accept_webhook(
        public_id: str,
        request: Request,
        x_provider_event_id: str | None = Header(default=None, alias="X-Provider-Event-ID"),
        x_provider_signature: str | None = Header(default=None, alias="X-Provider-Signature"),
        x_event_id: str | None = Header(default=None, alias="X-Event-ID"),
        x_signature: str | None = Header(default=None, alias="X-Signature"),
        s: ProviderWebhookUseCases = service,
    ):
        try:
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > s.max_payload_bytes:
                    raise ApplicationError(
                        "webhook_too_large", "Webhook payload exceeds limit", 413
                    )
            delivery = await s.accept(
                public_id,
                x_provider_event_id or x_event_id or "",
                bytes(body),
                x_provider_signature or x_signature or "",
            )
            return {"delivery_id": str(delivery.id), "status": "accepted"}
        except ApplicationError as error:
            fail(error)

    return router
