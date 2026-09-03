"""Persistent user identities."""

from enum import StrEnum

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class UserStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, RevisionMixin, Base):
    """A Human or service identity; authorization is granted by memberships."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[UserStatus] = mapped_column(
        Enum(
            UserStatus,
            name="user_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=UserStatus.ACTIVE,
    )
    is_platform_admin: Mapped[bool] = mapped_column(default=False)
