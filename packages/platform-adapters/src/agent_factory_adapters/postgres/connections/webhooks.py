from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from typing import cast
from uuid import UUID

from agent_factory_core.connections.providers.webhooks import (
    WebhookDelivery,
    WebhookDeliveryStatus,
    WebhookEndpoint,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresWebhookRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def connection_exists(self, workspace_id: UUID, connection_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text("""SELECT EXISTS(SELECT 1 FROM integration_connections
            WHERE workspace_id=:wid AND id=:id AND deleted_at IS NULL)"""),
                {"wid": workspace_id, "id": connection_id},
            )
        )

    @staticmethod
    def _endpoint(row: Mapping[str, object]) -> WebhookEndpoint:
        return WebhookEndpoint(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["connection_id"])),
            str(row["public_id"]),
            cast(bytes, row["encrypted_signing_secret"]),
            int(str(row["encryption_key_version"])),
            bool(row["is_active"]),
            UUID(str(row["requested_by_user_id"])) if row["requested_by_user_id"] else None,
        )

    @staticmethod
    def _delivery(row: Mapping[str, object]) -> WebhookDelivery:
        return WebhookDelivery(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["webhook_endpoint_id"])),
            str(row["provider_event_id"]),
            dict(cast(Mapping[str, object], row["payload"])),
            bool(row["signature_verified"]),
            cast(datetime, row["created_at"]),
            WebhookDeliveryStatus(str(row["status"])),
            int(str(row["attempt_count"])),
            cast(datetime | None, row["next_attempt_at"]),
            str(row["last_error"]) if row["last_error"] else None,
            cast(datetime | None, row["finished_at"]),
        )

    async def insert_endpoint(self, value: WebhookEndpoint) -> WebhookEndpoint:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO webhook_endpoints
            (id,workspace_id,connection_id,public_id,encrypted_signing_secret,encryption_key_version,is_active,requested_by_user_id)
            VALUES (:id,:wid,:connection,:public,:secret,:version,:active,:requester) RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "connection": value.connection_id,
                        "public": value.public_id,
                        "secret": value.encrypted_signing_secret,
                        "version": value.key_version,
                        "active": value.active,
                        "requester": value.requested_by_user_id,
                    },
                )
            )
            .mappings()
            .one()
        )
        return self._endpoint(row)

    async def endpoint_by_public_id(self, public_id: str) -> WebhookEndpoint | None:
        await self.session.execute(
            text("SELECT set_config('app.current_webhook_public_id', :value, true)"),
            {"value": public_id},
        )
        row = (
            (
                await self.session.execute(
                    text("""SELECT * FROM webhook_endpoints
            WHERE public_id=:public AND is_active=true AND deleted_at IS NULL"""),
                    {"public": public_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._endpoint(row) if row else None

    async def delivery(self, endpoint_id: UUID, event_id: str) -> WebhookDelivery | None:
        workspace_id = await self.session.scalar(
            text("""SELECT workspace_id FROM webhook_endpoints
            WHERE id=:endpoint AND public_id=nullif(
              current_setting('app.current_webhook_public_id', true), '')"""),
            {"endpoint": endpoint_id},
        )
        if workspace_id is not None:
            await self.session.execute(
                text("SELECT set_config('app.current_workspace_id', :value, true)"),
                {"value": str(workspace_id)},
            )
        row = (
            (
                await self.session.execute(
                    text("""SELECT * FROM webhook_deliveries
            WHERE webhook_endpoint_id=:endpoint AND provider_event_id=:event"""),
                    {"endpoint": endpoint_id, "event": event_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._delivery(row) if row else None

    async def insert_delivery(self, value: WebhookDelivery) -> WebhookDelivery:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO webhook_deliveries
            (id,workspace_id,webhook_endpoint_id,provider_event_id,status,signature_verified,payload)
            VALUES (:id,:wid,:endpoint,:event,'pending',true,CAST(:payload AS jsonb)) RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "endpoint": value.endpoint_id,
                        "event": value.provider_event_id,
                        "payload": json.dumps(value.payload),
                    },
                )
            )
            .mappings()
            .one()
        )
        return self._delivery(row)

    async def claim_delivery(
        self, workspace_id: UUID, delivery_id: UUID, now: datetime
    ) -> WebhookDelivery | None:
        row = (
            (
                await self.session.execute(
                    text("""UPDATE webhook_deliveries SET status='processing',
            attempt_count=attempt_count+1,next_attempt_at=NULL,updated_at=:now
            WHERE workspace_id=:wid AND id=:id AND signature_verified=true
            AND status IN ('pending','failed')
            AND (next_attempt_at IS NULL OR next_attempt_at<=:now) RETURNING *"""),
                    {"wid": workspace_id, "id": delivery_id, "now": now},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is not None:
            return self._delivery(row)
        existing = (
            (
                await self.session.execute(
                    text("""SELECT * FROM webhook_deliveries WHERE workspace_id=:wid
            AND id=:id AND status IN ('succeeded','dead')"""),
                    {"wid": workspace_id, "id": delivery_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._delivery(existing) if existing else None

    async def save_delivery(self, value: WebhookDelivery) -> WebhookDelivery:
        row = (
            (
                await self.session.execute(
                    text("""UPDATE webhook_deliveries SET status=:status,
            next_attempt_at=:retry,last_error=:error,finished_at=:finished,updated_at=now()
            WHERE workspace_id=:wid AND id=:id AND status='processing' RETURNING *"""),
                    {
                        "status": value.status.value,
                        "retry": value.next_attempt_at,
                        "error": value.last_error,
                        "finished": value.finished_at,
                        "wid": value.workspace_id,
                        "id": value.id,
                    },
                )
            )
            .mappings()
            .one()
        )
        return self._delivery(row)

    async def due_delivery_ids(self, now: datetime, limit: int = 100) -> list[UUID]:
        rows = await self.session.scalars(
            text("""SELECT id FROM webhook_deliveries WHERE signature_verified=true
            AND status IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at<=:now)
            ORDER BY COALESCE(next_attempt_at,created_at),id FOR UPDATE SKIP LOCKED LIMIT :limit"""),
            {"now": now, "limit": limit},
        )
        return [UUID(str(value)) for value in rows]

    async def delivery_authority(self, delivery_id: UUID):
        row = (
            (
                await self.session.execute(
                    text("""SELECT d.workspace_id,e.requested_by_user_id,w.organization_id
            FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.webhook_endpoint_id
            JOIN workspaces w ON w.id=d.workspace_id
            WHERE d.id=:id AND d.signature_verified=true AND e.is_active=true
            AND e.deleted_at IS NULL"""),
                    {"id": delivery_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None or row["requested_by_user_id"] is None:
            return None
        return (
            UUID(str(row["organization_id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["requested_by_user_id"])),
        )

    async def reject_unauthorized_delivery(self, delivery_id: UUID, now: datetime) -> bool:
        result = await self.session.execute(
            text("""UPDATE webhook_deliveries SET status='dead',attempt_count=attempt_count+1,
            next_attempt_at=NULL,last_error='webhook_requester_unavailable',finished_at=:now,
            updated_at=:now WHERE id=:id AND status NOT IN ('succeeded','dead')"""),
            {"id": delivery_id, "now": now},
        )
        await self.session.commit()
        return bool(getattr(result, "rowcount", 0))

    async def enabled_collection_ids(self, delivery: WebhookDelivery) -> list[UUID]:
        values = await self.session.scalars(
            text("""SELECT c.id FROM integration_collections c
            JOIN webhook_endpoints e ON e.connection_id=c.connection_id
            WHERE e.id=:endpoint AND e.workspace_id=:wid AND c.workspace_id=:wid
            AND c.is_enabled=true ORDER BY c.id"""),
            {"endpoint": delivery.endpoint_id, "wid": delivery.workspace_id},
        )
        return [UUID(str(value)) for value in values]

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
