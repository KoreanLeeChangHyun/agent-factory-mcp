"""Workspace persistence operations under an established tenant context."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import User
from app.modules.organization.models import OrganizationMembership, Role, RoleScope
from app.modules.workspace.models import (
    Workspace,
    WorkspaceMembership,
    WorkspaceRepository,
    WorkspaceStatus,
    WorkspaceVisit,
)


class WorkspaceRepositoryStore:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, organization_id: UUID) -> list[Workspace]:
        result = await self.session.scalars(
            select(Workspace)
            .where(Workspace.organization_id == organization_id, Workspace.deleted_at.is_(None))
            .order_by(Workspace.name, Workspace.id)
        )
        return list(result)

    async def recent(self, organization_id: UUID, user_id: UUID) -> list[Workspace]:
        result = await self.session.scalars(
            select(Workspace)
            .join(WorkspaceVisit, WorkspaceVisit.workspace_id == Workspace.id)
            .where(
                Workspace.organization_id == organization_id,
                WorkspaceVisit.user_id == user_id,
                Workspace.deleted_at.is_(None),
            )
            .order_by(WorkspaceVisit.last_opened_at.desc())
            .limit(20)
        )
        return list(result)

    async def get(self, organization_id: UUID, workspace_id: UUID) -> Workspace | None:
        return await self.session.scalar(
            select(Workspace).where(
                Workspace.id == workspace_id,
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
            )
        )

    async def create(self, organization_id: UUID, name: str, slug: str) -> Workspace:
        workspace = Workspace(organization_id=organization_id, name=name, slug=slug)
        self.session.add(workspace)
        await self.session.flush()
        return workspace

    async def select_workspace_context(self, workspace_id: UUID) -> None:
        await self.session.execute(
            text("SELECT set_config('app.current_workspace_id', :workspace_id, true)"),
            {"workspace_id": str(workspace_id)},
        )

    async def update(
        self, organization_id: UUID, workspace_id: UUID, name: str, revision: int
    ) -> Workspace | None:
        return await self.session.scalar(
            update(Workspace)
            .where(
                Workspace.id == workspace_id,
                Workspace.organization_id == organization_id,
                Workspace.revision == revision,
                Workspace.deleted_at.is_(None),
            )
            .values(name=name, revision=Workspace.revision + 1)
            .returning(Workspace)
        )

    async def deactivate(self, organization_id: UUID, workspace_id: UUID) -> bool:
        result = await self.session.execute(
            update(Workspace)
            .where(
                Workspace.id == workspace_id,
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
            )
            .values(status=WorkspaceStatus.INACTIVE, revision=Workspace.revision + 1)
        )
        return bool(result.rowcount)

    async def add_repository(
        self,
        workspace_id: UUID,
        canonical_location: str,
        remote_url: str | None,
        metadata: dict[str, object],
    ) -> WorkspaceRepository:
        repository = WorkspaceRepository(
            workspace_id=workspace_id,
            canonical_location=canonical_location,
            remote_url=remote_url,
            repository_metadata=metadata,
        )
        self.session.add(repository)
        await self.session.flush()
        return repository

    async def list_repositories(self, workspace_id: UUID) -> list[WorkspaceRepository]:
        result = await self.session.scalars(
            select(WorkspaceRepository)
            .where(
                WorkspaceRepository.workspace_id == workspace_id,
                WorkspaceRepository.deleted_at.is_(None),
            )
            .order_by(WorkspaceRepository.canonical_location)
        )
        return list(result)

    async def record_visit(self, user_id: UUID, workspace_id: UUID) -> None:
        now = datetime.now(UTC)
        statement = insert(WorkspaceVisit).values(
            user_id=user_id,
            workspace_id=workspace_id,
            last_opened_at=now,
        )
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=[WorkspaceVisit.user_id, WorkspaceVisit.workspace_id],
                set_={"last_opened_at": now, "updated_at": now},
            )
        )

    async def usage(self, workspace_id: UUID) -> tuple[int, int]:
        members = await self.session.scalar(
            select(func.count())
            .select_from(WorkspaceMembership)
            .where(WorkspaceMembership.workspace_id == workspace_id)
        )
        repositories = await self.session.scalar(
            select(func.count())
            .select_from(WorkspaceRepository)
            .where(
                WorkspaceRepository.workspace_id == workspace_id,
                WorkspaceRepository.deleted_at.is_(None),
            )
        )
        return int(members or 0), int(repositories or 0)

    async def list_members(self, workspace_id: UUID) -> list[tuple[User, str]]:
        rows = await self.session.execute(
            select(User, Role.name)
            .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
            .join(Role, Role.id == WorkspaceMembership.role_id)
            .where(WorkspaceMembership.workspace_id == workspace_id)
            .order_by(User.email)
        )
        return [(row[0], row[1]) for row in rows]

    async def resolve_organization_user(
        self, organization_id: UUID, normalized_email: str
    ) -> User | None:
        return await self.session.scalar(
            select(User)
            .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
            .where(
                OrganizationMembership.organization_id == organization_id,
                func.lower(User.email) == normalized_email,
                User.deleted_at.is_(None),
            )
        )

    async def resolve_workspace_role(self, role_name: str) -> Role | None:
        return await self.session.scalar(
            select(Role).where(
                Role.organization_id.is_(None),
                Role.scope == RoleScope.WORKSPACE,
                Role.name == role_name,
            )
        )

    async def add_member(self, workspace_id: UUID, user_id: UUID, role_id: UUID) -> None:
        self.session.add(
            WorkspaceMembership(workspace_id=workspace_id, user_id=user_id, role_id=role_id)
        )
        await self.session.flush()

    async def remove_member(self, workspace_id: UUID, user_id: UUID) -> bool:
        membership = await self.session.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == user_id,
            )
        )
        if membership is None:
            return False
        await self.session.delete(membership)
        return True

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
