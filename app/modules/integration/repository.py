"""Integration catalog, connections, OAuth state, and webhook persistence."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integration.models import (
    ConnectionStatus,
    IntegrationConnection,
    IntegrationOAuthState,
    IntegrationProvider,
    WebhookDelivery,
    WebhookEndpoint,
)


class IntegrationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_providers(self) -> list[IntegrationProvider]:
        return list(
            await self.session.scalars(
                select(IntegrationProvider)
                .where(IntegrationProvider.is_enabled.is_(True))
                .order_by(IntegrationProvider.display_name)
            )
        )

    async def get_provider(self, provider_id: UUID) -> IntegrationProvider | None:
        return await self.session.scalar(
            select(IntegrationProvider).where(
                IntegrationProvider.id == provider_id,
                IntegrationProvider.is_enabled.is_(True),
            )
        )

    async def list_connections(self, workspace_id: UUID) -> list[IntegrationConnection]:
        return list(
            await self.session.scalars(
                select(IntegrationConnection)
                .where(
                    IntegrationConnection.workspace_id == workspace_id,
                    IntegrationConnection.deleted_at.is_(None),
                )
                .order_by(IntegrationConnection.name)
            )
        )

    async def get_connection(
        self, workspace_id: UUID, connection_id: UUID
    ) -> IntegrationConnection | None:
        return await self.session.scalar(
            select(IntegrationConnection).where(
                IntegrationConnection.id == connection_id,
                IntegrationConnection.workspace_id == workspace_id,
                IntegrationConnection.deleted_at.is_(None),
            ).execution_options(populate_existing=True)
        )

    async def create_connection(
        self,
        workspace_id: UUID,
        provider_id: UUID,
        name: str,
        encrypted_credentials: bytes | None,
        key_version: int | None,
    ) -> IntegrationConnection:
        connection = IntegrationConnection(
            workspace_id=workspace_id,
            provider_id=provider_id,
            name=name,
            status=(ConnectionStatus.ACTIVE if encrypted_credentials else ConnectionStatus.PENDING),
            encrypted_credentials=encrypted_credentials,
            encryption_key_version=key_version,
            sync_cursor={},
        )
        self.session.add(connection)
        await self.session.flush()
        return connection

    async def disconnect(self, workspace_id: UUID, connection_id: UUID) -> bool:
        result = await self.session.execute(
            update(IntegrationConnection)
            .where(
                IntegrationConnection.id == connection_id,
                IntegrationConnection.workspace_id == workspace_id,
                IntegrationConnection.deleted_at.is_(None),
            )
            .values(
                status=ConnectionStatus.DISCONNECTED,
                encrypted_credentials=None,
                encryption_key_version=None,
                sync_cursor={},
                revision=IntegrationConnection.revision + 1,
            )
        )
        return bool(result.rowcount)

    async def update_cursor(
        self, workspace_id: UUID, connection_id: UUID, cursor: dict[str, object]
    ) -> bool:
        result = await self.session.execute(
            update(IntegrationConnection)
            .where(
                IntegrationConnection.id == connection_id,
                IntegrationConnection.workspace_id == workspace_id,
                IntegrationConnection.status == ConnectionStatus.ACTIVE,
            )
            .values(sync_cursor=cursor, last_synced_at=datetime.now(UTC))
        )
        return bool(result.rowcount)

    async def create_oauth_state(self, state: IntegrationOAuthState) -> None:
        self.session.add(state)
        await self.session.flush()

    async def consume_oauth_state(
        self, state_digest: bytes, now: datetime
    ) -> IntegrationOAuthState | None:
        state = await self.session.scalar(
            select(IntegrationOAuthState)
            .where(
                IntegrationOAuthState.state_digest == state_digest,
                IntegrationOAuthState.consumed_at.is_(None),
                IntegrationOAuthState.expires_at > now,
            )
            .with_for_update()
        )
        if state is not None:
            state.consumed_at = now
        return state

    async def create_webhook_endpoint(self, endpoint: WebhookEndpoint) -> None:
        self.session.add(endpoint)
        await self.session.flush()

    async def get_webhook_endpoint(self, public_id: str) -> WebhookEndpoint | None:
        await self.session.execute(
            text("SELECT set_config('app.current_webhook_public_id', :public_id, true)"),
            {"public_id": public_id},
        )
        endpoint = await self.session.scalar(
            select(WebhookEndpoint).where(
                WebhookEndpoint.public_id == public_id,
                WebhookEndpoint.is_active.is_(True),
                WebhookEndpoint.deleted_at.is_(None),
            )
        )
        if endpoint is not None:
            await self.session.execute(
                text("SELECT set_config('app.current_workspace_id', :workspace_id, true)"),
                {"workspace_id": str(endpoint.workspace_id)},
            )
        return endpoint

    async def create_delivery(self, delivery: WebhookDelivery) -> None:
        self.session.add(delivery)
        await self.session.flush()

    async def find_delivery(
        self, endpoint_id: UUID, provider_event_id: str
    ) -> WebhookDelivery | None:
        return await self.session.scalar(
            select(WebhookDelivery).where(
                WebhookDelivery.webhook_endpoint_id == endpoint_id,
                WebhookDelivery.provider_event_id == provider_event_id,
            )
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
