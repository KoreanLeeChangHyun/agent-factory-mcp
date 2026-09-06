"""Workspace lifecycle and membership use cases."""

from __future__ import annotations

from app.modules.auth.authorization import require_context

from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.core.config import Settings
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizedContext,
)
from app.modules.identity.models import User
from app.modules.organization.system_roles import WORKSPACE_OWNER_ROLE_ID
from app.modules.workspace.models import Workspace, WorkspaceRepository
from app.modules.workspace.repository import WorkspaceRepositoryStore


class WorkspaceService:
    def __init__(self, repository: WorkspaceRepositoryStore, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    async def list(self, context: AuthorizedContext) -> list[Workspace]:
        require_context(context, "organization.read")
        rows = await self.repository.list(context.scope.organization_id)
        return await self._visible(context, rows)

    async def recent(self, context: AuthorizedContext) -> list[Workspace]:
        require_context(context, "organization.read")
        rows = await self.repository.recent(
            context.scope.organization_id, context.principal.user_id
        )
        return await self._visible(context, rows)

    async def _visible(self, context, rows):
        authorizer = AuthorizationRepository(self.repository.session)
        result = []
        for row in rows:
            keys = await authorizer.permission_keys(
                context.principal, AuthorizationScope(context.scope.organization_id, row.id)
            )
            if "workspace.read" in keys:
                result.append(row)
        return result

    async def get(self, context: AuthorizedContext) -> Workspace:
        require_context(context, "workspace.read")
        workspace_id = _workspace_id(context)
        workspace = await self.repository.get(context.scope.organization_id, workspace_id)
        if workspace is None:
            raise NotFoundError("workspace_not_found", "Workspace not found")
        return workspace

    async def record_visit(self, context: AuthorizedContext) -> None:
        await self.repository.record_visit(context.principal.user_id, _workspace_id(context))
        await self.repository.commit()

    async def create(self, context: AuthorizedContext, name: str, slug: str) -> Workspace:
        require_context(context, "workspace.create")
        try:
            workspace = await self.repository.create(
                context.scope.organization_id, name.strip(), slug
            )
            await self.repository.select_workspace_context(workspace.id)
            await self.repository.add_member(
                workspace.id, context.principal.user_id, WORKSPACE_OWNER_ROLE_ID
            )
            await self.repository.commit()
            return workspace
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError("workspace_slug_conflict", "Workspace slug already exists") from exc

    async def update(self, context: AuthorizedContext, name: str, revision: int) -> Workspace:
        require_context(context, "workspace.update")
        workspace = await self.repository.update(
            context.scope.organization_id,
            _workspace_id(context),
            name.strip(),
            revision,
        )
        if workspace is None:
            raise ConflictError("workspace_revision_conflict", "Workspace changed concurrently")
        await self.repository.commit()
        return workspace

    async def deactivate(self, context: AuthorizedContext) -> None:
        require_context(context, "workspace.delete")
        changed = await self.repository.deactivate(
            context.scope.organization_id, _workspace_id(context)
        )
        if not changed:
            raise NotFoundError("workspace_not_found", "Workspace not found")
        await self.repository.commit()

    async def add_repository(
        self,
        context: AuthorizedContext,
        location: str,
        remote_url: str | None,
        metadata: dict[str, object],
    ) -> WorkspaceRepository:
        require_context(context, "repository.create")
        canonical = canonical_repository_location(location, self.settings.environment)
        try:
            record = await self.repository.add_repository(
                _workspace_id(context), canonical, remote_url, metadata
            )
            await self.repository.commit()
            return record
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError(
                "repository_already_registered", "Repository is already registered"
            ) from exc

    async def delete_repository(self, context: AuthorizedContext, repository_id: UUID) -> None:
        from datetime import UTC, datetime
        from sqlalchemy import select

        require_context(context, "repository.delete")
        record = await self.repository.session.scalar(
            select(WorkspaceRepository)
            .where(
                WorkspaceRepository.id == repository_id,
                WorkspaceRepository.workspace_id == _workspace_id(context),
                WorkspaceRepository.deleted_at.is_(None),
            )
            .with_for_update()
        )
        if record is None:
            raise NotFoundError("repository_not_found", "저장소를 찾을 수 없습니다.")
        record.deleted_at = datetime.now(UTC)
        await self.repository.commit()

    async def list_repositories(self, context: AuthorizedContext) -> list[WorkspaceRepository]:
        require_context(context, "repository.read")
        return await self.repository.list_repositories(_workspace_id(context))

    async def usage(self, context: AuthorizedContext) -> tuple[int, int]:
        return await self.repository.usage(_workspace_id(context))

    async def list_members(self, context: AuthorizedContext) -> list[tuple[User, str]]:
        require_context(context, "workspace.manage_members")
        return await self.repository.list_members(_workspace_id(context))

    async def add_member(self, context: AuthorizedContext, email: str, role_name: str) -> None:
        from app.modules.organization.service import OrganizationService

        user = await self.repository.resolve_organization_user(
            context.scope.organization_id, email.strip().casefold()
        )
        role = await self.repository.resolve_workspace_role(role_name)
        if user is None or role is None:
            raise NotFoundError(
                "organization_member_not_found", "구성원 또는 역할을 찾을 수 없습니다."
            )
        await OrganizationService(
            self.repository.session, context.principal, context.scope.organization_id
        ).set_workspace_member(_workspace_id(context), user.id, role.id)
        await self.repository.commit()

    async def remove_member(self, context: AuthorizedContext, user_id: UUID) -> None:
        from app.modules.organization.service import OrganizationService

        await OrganizationService(
            self.repository.session, context.principal, context.scope.organization_id
        ).set_workspace_member(_workspace_id(context), user_id, None)
        await self.repository.commit()


def canonical_repository_location(location: str, environment: str) -> str:
    candidate = location.strip()
    if candidate.startswith("git@") and ":" in candidate:
        host, path = candidate[4:].split(":", 1)
        return f"ssh://git@{host.casefold()}/{path.removesuffix('.git').strip('/')}"
    parsed = urlsplit(candidate)
    if parsed.scheme in {"https", "ssh"} and parsed.hostname:
        host = parsed.hostname.casefold()
        port = f":{parsed.port}" if parsed.port else ""
        username = f"{parsed.username}@" if parsed.username else ""
        netloc = f"{username}{host}{port}"
        return urlunsplit(
            (parsed.scheme.casefold(), netloc, parsed.path.rstrip("/").removesuffix(".git"), "", "")
        )
    if environment in {"local", "test"}:
        return str(Path(candidate).expanduser().resolve(strict=False))
    raise ApplicationError(
        "remote_repository_required", "A remote HTTPS or SSH repository is required", 400
    )


def _workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
