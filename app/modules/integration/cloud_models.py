"""Cloud collection state is independent from logical provider connections."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CloudConnectionState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = 'integration_cloud_connection_states'
    __table_args__ = (UniqueConstraint('workspace_id', 'connection_id'),)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey('workspaces.id', ondelete='CASCADE'), index=True)
    connection_id: Mapped[UUID] = mapped_column(ForeignKey('integration_connections.id', ondelete='CASCADE'))
    requested_scopes: Mapped[list] = mapped_column(JSON, default=list)
    granted_scopes: Mapped[list | None] = mapped_column(JSON)
    inspection: Mapped[dict] = mapped_column(JSON, default=dict)
    inspected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CloudCollection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = 'integration_collections'
    __table_args__ = (UniqueConstraint('workspace_id', 'connection_id', 'name'),)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey('workspaces.id', ondelete='CASCADE'), index=True)
    connection_id: Mapped[UUID] = mapped_column(ForeignKey('integration_connections.id', ondelete='RESTRICT'))
    provider: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(160))
    selection: Mapped[dict] = mapped_column(JSON)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='RESTRICT'))


class CloudCollectionRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = 'integration_collection_runs'
    __table_args__ = (UniqueConstraint('workspace_id', 'collection_id', 'request_key'),)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey('workspaces.id', ondelete='CASCADE'), index=True)
    collection_id: Mapped[UUID] = mapped_column(ForeignKey('integration_collections.id', ondelete='RESTRICT'))
    requested_by_user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='RESTRICT'))
    request_key: Mapped[str] = mapped_column(String(160))
    job_id: Mapped[UUID | None] = mapped_column(ForeignKey('jobs.id', ondelete='SET NULL'))
    status: Mapped[str] = mapped_column(String(30), default='queued')
    cursor: Mapped[dict] = mapped_column(JSON, default=dict)
    results: Mapped[list] = mapped_column(JSON, default=list)
    examined: Mapped[int] = mapped_column(default=0)
    pages: Mapped[int] = mapped_column(default=0)
    bytes_read: Mapped[int] = mapped_column(default=0)
    cancel_requested: Mapped[bool] = mapped_column(default=False)
    error_code: Mapped[str | None] = mapped_column(String(100))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CloudSourceMapping(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = 'integration_source_mappings'
    __table_args__ = (UniqueConstraint('workspace_id', 'collection_id', 'source_id'),)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey('workspaces.id', ondelete='CASCADE'), index=True)
    collection_id: Mapped[UUID] = mapped_column(ForeignKey('integration_collections.id', ondelete='RESTRICT'))
    source_id: Mapped[str] = mapped_column(String(500))
    document_id: Mapped[UUID] = mapped_column(ForeignKey('documents.id', ondelete='RESTRICT'))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    revision_number: Mapped[int | None]
