"""Organization, role, permission, and membership persistence."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    LargeBinary,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class RoleScope(StrEnum):
    PLATFORM = "platform"
    ORGANIZATION = "organization"
    WORKSPACE = "workspace"


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, RevisionMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    is_personal: Mapped[bool] = mapped_column(default=False)


class Permission(TimestampMixin, Base):
    __tablename__ = "permissions"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    description: Mapped[str] = mapped_column(String(500))


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("organization_id", "scope", "name"),
        Index(
            "uq_roles_system_scope_name",
            "scope",
            "name",
            unique=True,
            postgresql_where=text("organization_id IS NULL"),
        ),
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    scope: Mapped[RoleScope] = mapped_column(
        Enum(
            RoleScope,
            name="role_scope",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda members: [member.value for member in members],
        )
    )
    name: Mapped[str] = mapped_column(String(80))
    is_system: Mapped[bool] = mapped_column(default=False)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_key: Mapped[str] = mapped_column(
        ForeignKey("permissions.key", ondelete="CASCADE"), primary_key=True
    )


class MembershipStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REMOVED = "removed"


class OrganizationMembership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))

    status: Mapped[MembershipStatus] = mapped_column(
        Enum(
            MembershipStatus,
            name="organization_membership_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda values: [v.value for v in values],
        ),
        default=MembershipStatus.ACTIVE,
        server_default="active",
    )


class OrganizationTeam(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_teams"
    __table_args__ = (
        UniqueConstraint("organization_id", "name"),
        UniqueConstraint("organization_id", "id", name="uq_organization_teams_organization_id_id"),
    )
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(1000), default="")


class TeamMembership(TimestampMixin, Base):
    __tablename__ = "team_memberships"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "team_id"],
            ["organization_teams.organization_id", "organization_teams.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_memberships.organization_id", "organization_memberships.user_id"],
            ondelete="CASCADE",
        ),
    )
    organization_id: Mapped[UUID] = mapped_column(index=True)
    team_id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(primary_key=True)


class TeamWorkspaceGrant(TimestampMixin, Base):
    __tablename__ = "team_workspace_grants"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "team_id"],
            ["organization_teams.organization_id", "organization_teams.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["organization_id", "workspace_id"],
            ["workspaces.organization_id", "workspaces.id"],
            ondelete="CASCADE",
        ),
    )
    organization_id: Mapped[UUID] = mapped_column(index=True)
    team_id: Mapped[UUID] = mapped_column(primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(primary_key=True)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))


class OrganizationInvitation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_invitations"
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), index=True)
    role_id: Mapped[UUID | None] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"))
    invited_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    token_digest: Mapped[bytes] = mapped_column(LargeBinary(32), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    workspace_grants: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
