"""Declarative database base and cross-domain persistence policies."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(AsyncAttrs, DeclarativeBase):
    """Base for all authoritative PostgreSQL models."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    """Application-generated identifiers avoid database round trips."""

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)


class TimestampMixin:
    """UTC audit timestamps shared by mutable records."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Recoverable deletion marker for records governed by retention policy."""

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RevisionMixin:
    """Monotonic revision used for optimistic concurrency checks."""

    revision: Mapped[int] = mapped_column(default=1, nullable=False)
