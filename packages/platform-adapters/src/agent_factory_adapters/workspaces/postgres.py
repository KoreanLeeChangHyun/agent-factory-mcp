"""PostgreSQL Workspace/account adapter over the deployed table identities."""

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from agent_factory_core.identity import Principal
from agent_factory_core.organizations.system_roles import (
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from agent_factory_core.shared.errors import ApplicationError, ConflictError
from agent_factory_core.workspaces import (
    OrganizationSummary,
    OrganizationUserRecord,
    RepositoryRecord,
    WorkspaceGroupRecord,
    WorkspaceRecord,
    WorkspaceRoleRecord,
    WorkspaceStatus,
)
from agent_factory_core.workspaces.policies import canonical_remote_repository
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


def _workspace(row: Any) -> WorkspaceRecord:
    item = row._mapping if hasattr(row, "_mapping") else row
    return WorkspaceRecord(
        item["id"],
        item["organization_id"],
        item["name"],
        item["slug"],
        WorkspaceStatus(item["status"]),
        item["revision"],
        item["created_at"],
        item["updated_at"],
        item["deleted_at"],
    )


def _organization(row: Any) -> OrganizationSummary:
    item = row._mapping if hasattr(row, "_mapping") else row
    return OrganizationSummary(item["id"], item["name"], item["slug"], item["is_personal"])


class RemoteRepositoryLocationResolver:
    def canonicalize(self, location: str) -> str:
        return canonical_remote_repository(location)


def canonical_local_repository(location: str, *, root: Path) -> str:
    candidate = Path(location).expanduser().resolve(strict=False)
    resolved_root = root.resolve(strict=False)
    if candidate != resolved_root and resolved_root not in candidate.parents:
        raise ApplicationError(
            "repository_path_outside_root", "Repository path is outside the configured root"
        )
    return str(candidate)


class LocalRepositoryLocationResolver:
    """The only adapter permitted to resolve local filesystem repository locations."""

    def __init__(self, root) -> None:
        self.root = root

    def canonicalize(self, location: str) -> str:
        return canonical_local_repository(location, root=self.root)


class EnvironmentRepositoryLocationResolver:
    """Preserve remote identities in every mode and allow local paths only locally."""

    def __init__(self, environment: str, root) -> None:
        self.environment = environment
        self.root = root

    def canonicalize(self, location: str) -> str:
        if location.strip().startswith(("git@", "ssh://", "https://", "git://")):
            return canonical_remote_repository(location)
        if self.environment in {"local", "test"}:
            return canonical_local_repository(location, root=self.root)
        return canonical_remote_repository(location)


class PostgresWorkspaceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_organizations(self, principal: Principal) -> list[OrganizationSummary]:
        await self.session.execute(
            text("SELECT set_config('app.current_user_id', :user_id, true)"),
            {"user_id": str(principal.user_id)},
        )
        rows = await self.session.execute(
            text("""
            SELECT o.id, o.name, o.slug, o.is_personal
              FROM organizations o
              JOIN organization_memberships m ON m.organization_id = o.id
             WHERE m.user_id = :user_id AND m.status = 'active' AND o.deleted_at IS NULL
             ORDER BY o.is_personal DESC, o.name, o.id
        """),
            {"user_id": principal.user_id},
        )
        return [_organization(row) for row in rows]

    async def lock_personal_provisioning(self, user_id: UUID) -> None:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"personal-workspace:{user_id}"},
        )

    async def find_personal_organization(self, user_id: UUID) -> OrganizationSummary | None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        row = (
            await self.session.execute(
                text("""
            SELECT o.id, o.name, o.slug, o.is_personal
              FROM organizations o JOIN organization_memberships m ON m.organization_id = o.id
             WHERE m.user_id = :user_id AND m.status = 'active'
               AND o.is_personal AND o.deleted_at IS NULL
             ORDER BY o.created_at LIMIT 1
        """),
                {"user_id": user_id},
            )
        ).first()
        return _organization(row) if row else None

    async def create_personal_organization(
        self, *, organization_id: UUID, user_id: UUID, name: str, slug: str
    ) -> OrganizationSummary:
        row = (
            await self.session.execute(
                text("""
            INSERT INTO organizations (id, name, slug, is_personal)
            VALUES (:id, :name, :slug, true)
            RETURNING id, name, slug, is_personal
        """),
                {"id": organization_id, "name": name, "slug": slug},
            )
        ).one()
        await self.session.execute(
            text("""
            INSERT INTO organization_memberships (id, organization_id, user_id, role_id, status)
            VALUES (gen_random_uuid(), :organization_id, :user_id, :role_id, 'active')
        """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "role_id": ORGANIZATION_OWNER_ROLE_ID,
            },
        )
        return _organization(row)

    async def establish_organization_context(
        self, principal: Principal, organization_id: UUID
    ) -> None:
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', 'false', true)")
        )
        await self.session.execute(
            text("SELECT set_config('app.current_user_id', :user_id, true)"),
            {"user_id": str(principal.user_id)},
        )
        await self.session.execute(
            text("SELECT set_config('app.current_organization_id', :id, true)"),
            {"id": str(organization_id)},
        )
        await self.session.execute(text("SELECT set_config('app.current_workspace_id', '', true)"))

    async def list_visible(self, organization_id: UUID, user_id: UUID) -> list[WorkspaceRecord]:
        rows = await self.session.execute(
            text("""
            SELECT DISTINCT w.* FROM workspaces w
             WHERE w.organization_id = :organization_id AND w.deleted_at IS NULL
               AND w.status = 'active' AND (
                 EXISTS (SELECT 1 FROM workspace_memberships wm
                          WHERE wm.workspace_id = w.id AND wm.user_id = :user_id)
                 OR EXISTS (SELECT 1 FROM team_workspace_grants twg
                     JOIN team_memberships tm ON tm.team_id = twg.team_id
                                            AND tm.organization_id = twg.organization_id
                     WHERE twg.workspace_id = w.id AND tm.user_id = :user_id)
               ) ORDER BY w.name, w.id
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )
        return [_workspace(row) for row in rows]

    async def list_recent(self, organization_id: UUID, user_id: UUID) -> list[WorkspaceRecord]:
        rows = await self.session.execute(
            text("""
            SELECT w.* FROM workspace_visits v JOIN workspaces w ON w.id = v.workspace_id
             WHERE v.user_id = :user_id AND w.organization_id = :organization_id
               AND w.deleted_at IS NULL AND w.status = 'active' AND (
                 EXISTS (SELECT 1 FROM workspace_memberships wm
                          WHERE wm.workspace_id = w.id AND wm.user_id = :user_id)
                 OR EXISTS (SELECT 1 FROM team_workspace_grants twg
                     JOIN team_memberships tm ON tm.team_id = twg.team_id
                                            AND tm.organization_id = twg.organization_id
                     WHERE twg.workspace_id = w.id AND tm.user_id = :user_id)
               )
             ORDER BY v.last_opened_at DESC LIMIT 12
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )
        return [_workspace(row) for row in rows]

    async def get_visible(
        self, organization_id: UUID, user_id: UUID, workspace_id: UUID
    ) -> WorkspaceRecord | None:
        rows = await self.list_visible(organization_id, user_id)
        return next((row for row in rows if row.id == workspace_id), None)

    async def create_workspace(
        self,
        *,
        workspace_id: UUID,
        organization_id: UUID,
        owner_user_id: UUID,
        name: str,
        slug: str,
    ) -> WorkspaceRecord:
        try:
            row = (
                await self.session.execute(
                    text("""
                INSERT INTO workspaces (id, organization_id, name, slug, status)
                VALUES (:id, :organization_id, :name, :slug, 'active') RETURNING *
            """),
                    {
                        "id": workspace_id,
                        "organization_id": organization_id,
                        "name": name,
                        "slug": slug,
                    },
                )
            ).one()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError("workspace_slug_conflict", "Workspace slug already exists") from exc
        await self.session.execute(
            text("""
            INSERT INTO workspace_memberships (id, workspace_id, user_id, role_id)
            VALUES (gen_random_uuid(), :workspace_id, :user_id, :role_id)
        """),
            {
                "workspace_id": workspace_id,
                "user_id": owner_user_id,
                "role_id": WORKSPACE_OWNER_ROLE_ID,
            },
        )
        return _workspace(row)

    async def update_workspace(
        self, workspace_id: UUID, *, name: str, expected_revision: int
    ) -> WorkspaceRecord | None:
        row = (
            await self.session.execute(
                text("""
            UPDATE workspaces SET name = :name, revision = revision + 1, updated_at = now()
             WHERE id = :id AND revision = :revision AND deleted_at IS NULL RETURNING *
        """),
                {"id": workspace_id, "name": name, "revision": expected_revision},
            )
        ).first()
        return _workspace(row) if row else None

    async def deactivate_workspace(self, workspace_id: UUID) -> bool:
        row = (
            await self.session.execute(
                text("""
            UPDATE workspaces SET status = 'inactive', deleted_at = now(),
                   revision = revision + 1, updated_at = now()
             WHERE id = :id AND deleted_at IS NULL RETURNING id
        """),
                {"id": workspace_id},
            )
        ).first()
        return row is not None

    async def record_visit(self, user_id: UUID, workspace_id: UUID) -> None:
        await self.session.execute(
            text("""
            INSERT INTO workspace_visits (user_id, workspace_id, last_opened_at)
            VALUES (:user_id, :workspace_id, now())
            ON CONFLICT (user_id, workspace_id)
            DO UPDATE SET last_opened_at = excluded.last_opened_at, updated_at = now()
        """),
            {"user_id": user_id, "workspace_id": workspace_id},
        )

    async def list_groups(self, organization_id: UUID, user_id: UUID) -> list[WorkspaceGroupRecord]:
        rows = await self.session.execute(
            text("""
            SELECT g.id, g.organization_id, g.user_id, g.name, g.collapsed, g.revision,
                   COALESCE(array_agg(a.workspace_id ORDER BY a.position)
                     FILTER (WHERE a.workspace_id IS NOT NULL AND w.id IS NOT NULL AND (
                       EXISTS (SELECT 1 FROM workspace_memberships wm
                                WHERE wm.workspace_id = a.workspace_id
                                  AND wm.user_id = :user_id)
                       OR EXISTS (SELECT 1 FROM team_workspace_grants twg
                           JOIN team_memberships tm ON tm.team_id = twg.team_id
                                                  AND tm.organization_id = twg.organization_id
                           WHERE twg.workspace_id = a.workspace_id
                             AND tm.user_id = :user_id)
                     )), ARRAY[]::uuid[]) workspace_ids
              FROM workspace_groups g LEFT JOIN workspace_group_assignments a ON a.group_id = g.id
              LEFT JOIN workspaces w ON w.id = a.workspace_id AND w.deleted_at IS NULL
                                    AND w.status = 'active'
             WHERE g.organization_id = :organization_id AND g.user_id = :user_id
             GROUP BY g.id ORDER BY g.position, g.name
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )
        return [
            WorkspaceGroupRecord(
                row.id,
                row.organization_id,
                row.user_id,
                row.name,
                row.collapsed,
                row.revision,
                tuple(row.workspace_ids),
            )
            for row in rows
        ]

    async def create_group(
        self, *, group_id: UUID, organization_id: UUID, user_id: UUID, name: str
    ) -> WorkspaceGroupRecord:
        try:
            row = (
                await self.session.execute(
                    text("""
            INSERT INTO workspace_groups (id, organization_id, user_id, name, position)
            VALUES (:id, :organization_id, :user_id, :name,
                    COALESCE((SELECT max(position) + 1 FROM workspace_groups
                              WHERE organization_id = :organization_id AND user_id = :user_id), 0))
            RETURNING id, organization_id, user_id, name, collapsed, revision
        """),
                    {
                        "id": group_id,
                        "organization_id": organization_id,
                        "user_id": user_id,
                        "name": name,
                    },
                )
            ).one()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(
                "workspace_group_name_exists", "같은 이름의 그룹이 이미 있습니다."
            ) from exc
        return WorkspaceGroupRecord(
            row.id, row.organization_id, row.user_id, row.name, row.collapsed, row.revision
        )

    async def update_group(
        self,
        group_id: UUID,
        user_id: UUID,
        *,
        name: str | None,
        collapsed: bool | None,
        expected_revision: int,
    ) -> WorkspaceGroupRecord | None:
        try:
            row = (
                await self.session.execute(
                    text("""
            UPDATE workspace_groups
               SET name = COALESCE(:name, name), collapsed = COALESCE(:collapsed, collapsed),
                   revision = revision + 1, updated_at = now()
             WHERE id = :id AND user_id = :user_id AND revision = :revision
             RETURNING id, organization_id, user_id, name, collapsed, revision
        """),
                    {
                        "id": group_id,
                        "user_id": user_id,
                        "name": name,
                        "collapsed": collapsed,
                        "revision": expected_revision,
                    },
                )
            ).first()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(
                "workspace_group_name_exists", "같은 이름의 그룹이 이미 있습니다."
            ) from exc
        return (
            WorkspaceGroupRecord(
                row.id, row.organization_id, row.user_id, row.name, row.collapsed, row.revision
            )
            if row
            else None
        )

    async def assign_group(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        workspace_id: UUID,
        group_id: UUID | None,
    ) -> None:
        await self.session.execute(
            text("""
            DELETE FROM workspace_group_assignments
             WHERE user_id = :user_id AND workspace_id = :workspace_id
        """),
            {"user_id": user_id, "workspace_id": workspace_id},
        )
        if group_id is not None:
            await self.session.execute(
                text("""
                INSERT INTO workspace_group_assignments (user_id, workspace_id, group_id, position)
                SELECT :user_id, w.id, g.id, 0 FROM workspaces w, workspace_groups g
                 WHERE w.id = :workspace_id AND w.organization_id = :organization_id
                   AND w.deleted_at IS NULL AND g.id = :group_id
                   AND g.organization_id = :organization_id AND g.user_id = :user_id
            """),
                {
                    "organization_id": organization_id,
                    "user_id": user_id,
                    "workspace_id": workspace_id,
                    "group_id": group_id,
                },
            )

    async def register_repository(
        self,
        *,
        repository_id: UUID,
        workspace_id: UUID,
        location: str,
        remote_url: str | None,
        metadata: dict[str, object],
    ) -> RepositoryRecord:
        try:
            row = (
                await self.session.execute(
                    text("""
                INSERT INTO workspace_repositories
                    (id, workspace_id, canonical_location, remote_url, repository_metadata)
                VALUES (:id, :workspace_id, :location, :remote_url, CAST(:metadata AS jsonb))
                RETURNING id, workspace_id, canonical_location, remote_url,
                          repository_metadata, deleted_at
            """),
                    {
                        "id": repository_id,
                        "workspace_id": workspace_id,
                        "location": location,
                        "remote_url": remote_url,
                        "metadata": json.dumps(metadata),
                    },
                )
            ).one()
        except IntegrityError as exc:
            raise ConflictError(
                "repository_already_registered", "Repository is already registered"
            ) from exc
        return RepositoryRecord(
            row.id,
            row.workspace_id,
            row.canonical_location,
            row.remote_url,
            row.repository_metadata,
            row.deleted_at,
        )

    async def list_repositories(self, workspace_id: UUID) -> list[RepositoryRecord]:
        rows = await self.session.execute(
            text("""
            SELECT id, workspace_id, canonical_location, remote_url,
                   repository_metadata, deleted_at FROM workspace_repositories
             WHERE workspace_id = :workspace_id AND deleted_at IS NULL ORDER BY created_at, id
        """),
            {"workspace_id": workspace_id},
        )
        return [
            RepositoryRecord(
                row.id,
                row.workspace_id,
                row.canonical_location,
                row.remote_url,
                row.repository_metadata,
                row.deleted_at,
            )
            for row in rows
        ]

    async def soft_delete_repository(self, workspace_id: UUID, repository_id: UUID) -> bool:
        row = (
            await self.session.execute(
                text("""
            UPDATE workspace_repositories SET deleted_at = now(), revision = revision + 1
             WHERE workspace_id = :workspace_id AND id = :id AND deleted_at IS NULL RETURNING id
        """),
                {"workspace_id": workspace_id, "id": repository_id},
            )
        ).first()
        return row is not None

    async def workspace_usage(self, workspace_id: UUID) -> tuple[int, int]:
        row = (
            await self.session.execute(
                text("""
            SELECT (SELECT count(*) FROM workspace_memberships WHERE workspace_id = :id) members,
                   (SELECT count(*) FROM workspace_repositories
                     WHERE workspace_id = :id AND deleted_at IS NULL) repositories
        """),
                {"id": workspace_id},
            )
        ).one()
        return row.members, row.repositories

    async def list_members(self, workspace_id: UUID) -> list[tuple[OrganizationUserRecord, str]]:
        rows = await self.session.execute(
            text("""
            SELECT u.id, u.email, u.display_name, r.name AS role_name
              FROM users u JOIN workspace_memberships wm ON wm.user_id = u.id
              JOIN roles r ON r.id = wm.role_id
             WHERE wm.workspace_id = :workspace_id AND u.deleted_at IS NULL
             ORDER BY u.email
        """),
            {"workspace_id": workspace_id},
        )
        return [
            (OrganizationUserRecord(row.id, row.email, row.display_name), row.role_name)
            for row in rows
        ]

    async def resolve_organization_user(
        self, organization_id: UUID, normalized_email: str
    ) -> OrganizationUserRecord | None:
        row = (
            await self.session.execute(
                text("""
                SELECT u.id, u.email, u.display_name FROM users u
                  JOIN organization_memberships om ON om.user_id = u.id
                 WHERE om.organization_id = :organization_id AND om.status = 'active'
                   AND lower(u.email) = :email AND u.deleted_at IS NULL
            """),
                {"organization_id": organization_id, "email": normalized_email},
            )
        ).first()
        return OrganizationUserRecord(row.id, row.email, row.display_name) if row else None

    async def resolve_workspace_role(self, role_name: str) -> WorkspaceRoleRecord | None:
        row = (
            await self.session.execute(
                text("""
                SELECT id, name FROM roles WHERE organization_id IS NULL
                   AND scope = 'workspace' AND name = :name
            """),
                {"name": role_name},
            )
        ).first()
        return WorkspaceRoleRecord(row.id, row.name) if row else None

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
