"""One enrolled client credential and its verified MCP usage."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MCPConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_connections"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    token_id: Mapped[UUID] = mapped_column(
        ForeignKey("api_tokens.id", ondelete="CASCADE"), unique=True
    )
    encrypted_token: Mapped[bytes | None] = mapped_column(LargeBinary())
    encryption_key_version: Mapped[int | None]
    name: Mapped[str] = mapped_column(String(120))
    client_name: Mapped[str | None] = mapped_column(String(120))
    first_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
