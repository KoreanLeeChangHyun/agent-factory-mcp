"""Provider catalog, tenant connections, OAuth state, and webhook delivery."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class IntegrationAuthType(StrEnum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    SERVICE_ACCOUNT = "service_account"


class ConnectionStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"


class DeliveryStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    DEAD = "dead"


class IntegrationProvider(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_providers"

    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160))
    auth_type: Mapped[IntegrationAuthType] = mapped_column(
        Enum(
            IntegrationAuthType,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        )
    )
    capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)
    configuration_schema: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    is_enabled: Mapped[bool] = mapped_column(default=True)


class IntegrationConnection(
    UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, RevisionMixin, Base
):
    __tablename__ = "integration_connections"
    __table_args__ = (UniqueConstraint("workspace_id", "provider_id", "name"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("integration_providers.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    status: Mapped[ConnectionStatus] = mapped_column(
        Enum(
            ConnectionStatus,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        ),
        default=ConnectionStatus.PENDING,
    )
    encrypted_credentials: Mapped[bytes | None] = mapped_column(LargeBinary())
    encryption_key_version: Mapped[int | None]
    external_account_id: Mapped[str | None] = mapped_column(String(500))
    sync_cursor: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(120))
    last_error_message: Mapped[str | None] = mapped_column(Text)


class IntegrationOAuthState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_oauth_states"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("integration_providers.id", ondelete="CASCADE")
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    state_digest: Mapped[bytes] = mapped_column(LargeBinary(32), unique=True)
    encrypted_pkce_verifier: Mapped[bytes] = mapped_column(LargeBinary())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WebhookEndpoint(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "webhook_endpoints"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    connection_id: Mapped[UUID] = mapped_column(
        ForeignKey("integration_connections.id", ondelete="CASCADE"), unique=True
    )
    public_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    encrypted_signing_secret: Mapped[bytes] = mapped_column(LargeBinary())
    encryption_key_version: Mapped[int]
    is_active: Mapped[bool] = mapped_column(default=True)


class WebhookDelivery(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "webhook_deliveries"
    __table_args__ = (UniqueConstraint("webhook_endpoint_id", "provider_event_id"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    webhook_endpoint_id: Mapped[UUID] = mapped_column(
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), index=True
    )
    provider_event_id: Mapped[str] = mapped_column(String(500))
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(
            DeliveryStatus,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        ),
        default=DeliveryStatus.PENDING,
    )
    signature_verified: Mapped[bool] = mapped_column(default=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    attempt_count: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
