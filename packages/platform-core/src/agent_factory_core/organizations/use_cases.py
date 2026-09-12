"""Transactional organization commands with atomic audit persistence."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import (
    ApplicationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

from .domain import (
    InvitationProjection,
    MemberDetailProjection,
    MemberProjection,
    MembershipStatus,
    OrganizationRecord,
    RoleProjection,
    RoleRecord,
    RoleScope,
    TeamProjection,
    TeamRecord,
    WorkspaceGrant,
    WorkspaceOptionProjection,
)
from .policies import (
    INVITATION_LIFETIME,
    organization_slug,
    require_delegation,
    require_role_mutable,
    require_role_unused,
    role_for,
    validate_invitation,
    validate_invitation_acceptance,
    validate_member_change,
    validate_role_write,
    validate_workspace_owner_removal,
)
from .ports import Clock, InvitationEmail, InvitationTokens, OrganizationRepository
from .system_roles import WORKSPACE_OWNER_ROLE_ID


@dataclass(frozen=True, slots=True)
class OrganizationActor:
    principal: Principal
    permissions: frozenset[str]
    is_owner: bool
    workspace_permissions: dict[UUID, frozenset[str]] | None = None


class OrganizationUseCases:
    """Application boundary; each public mutation owns exactly one transaction."""

    def __init__(
        self,
        repository: OrganizationRepository,
        clock: Clock,
        tokens: InvitationTokens,
        email: InvitationEmail,
    ) -> None:
        self.repository = repository
        self.clock = clock
        self.tokens = tokens
        self.email = email

    @staticmethod
    def _require(actor: OrganizationActor, *keys: str) -> None:
        missing = next((key for key in keys if key not in actor.permissions), None)
        if missing:
            raise PermissionDeniedError("permission_required", f"Permission required: {missing}")

    async def _audit(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        action: str,
        target_id: UUID,
        metadata: dict[str, object] | None = None,
    ) -> None:
        await self.repository.append_audit(
            organization_id=organization_id,
            actor_user_id=actor.principal.user_id,
            action=action,
            target_type=action.split(".")[0],
            target_id=str(target_id),
            occurred_at=self.clock.now(),
            metadata=metadata or {},
        )

    async def _finish(self) -> None:
        try:
            await self.repository.commit()
        except Exception:
            await self.repository.rollback()
            raise

    async def _deliver(self, email: str, organization_id: UUID, token: str) -> None:
        try:
            await self.email.send_organization_invitation(email, organization_id, token)
        except Exception as exc:
            raise ApplicationError(
                "invitation_delivery_failed",
                "초대가 저장되었지만 메일 전송에 실패했습니다. 재전송하세요.",
                502,
            ) from exc

    async def create(
        self, actor: OrganizationActor, name: str, slug: str | None
    ) -> OrganizationRecord:
        organization_id = uuid4()
        resolved_slug = organization_slug(name, slug, organization_id)
        await self.repository.create_with_owner(
            organization_id=organization_id,
            name=name,
            slug=resolved_slug,
            owner_id=actor.principal.user_id,
        )
        await self._audit(organization_id, actor, "organization.create", organization_id)
        await self._finish()
        return OrganizationRecord(organization_id, name, resolved_slug, False, 1)

    async def update(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        *,
        name: str,
        slug: str | None,
        revision: int,
    ) -> None:
        self._require(actor, "organization.update")
        snapshot = await self.repository.lock_snapshot(organization_id)
        if snapshot.organization.revision != revision:
            raise ConflictError(
                "organization_revision_conflict", "조직 정보가 변경되었습니다. 다시 불러오세요."
            )
        await self.repository.update_organization(
            organization_id, name=name, slug=slug, expected_revision=revision
        )
        await self._audit(organization_id, actor, "organization.update", organization_id)
        await self._finish()

    async def delete(self, organization_id: UUID, actor: OrganizationActor) -> None:
        self._require(actor, "organization.delete")
        snapshot = await self.repository.lock_snapshot(organization_id)
        if not actor.is_owner:
            raise PermissionDeniedError("organization_owner_required")
        if snapshot.organization.is_personal:
            raise ConflictError("personal_organization_required", "개인 조직은 삭제할 수 없습니다.")
        await self.repository.soft_delete_organization(organization_id, self.clock.now())
        await self._audit(organization_id, actor, "organization.delete", organization_id)
        await self._finish()

    async def update_member(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        user_id: UUID,
        *,
        role_id: UUID | None = None,
        status: MembershipStatus | None = None,
    ) -> None:
        snapshot = await self.repository.lock_snapshot(organization_id)
        member = snapshot.member(user_id)
        if member is None:
            raise NotFoundError(
                "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다."
            )
        validate_member_change(
            snapshot,
            user_id,
            next_role_id=role_id,
            next_status=status,
            actor_is_owner=actor.is_owner,
        )
        require_delegation(
            role_for(snapshot, member.role_id, RoleScope.ORGANIZATION),
            actor_permissions=actor.permissions,
            actor_is_owner=actor.is_owner,
        )
        if role_id is not None:
            self._require(actor, "member.update_role", "role.assign")
            require_delegation(
                role_for(snapshot, role_id, RoleScope.ORGANIZATION),
                actor_permissions=actor.permissions,
                actor_is_owner=actor.is_owner,
            )
        if status is not None:
            self._require(
                actor, "member.remove" if status == MembershipStatus.REMOVED else "member.suspend"
            )
        validate_member_change(
            snapshot,
            user_id,
            next_role_id=role_id,
            next_status=status,
            actor_is_owner=actor.is_owner,
        )
        await self.repository.update_member(
            organization_id,
            user_id,
            role_id=role_id or member.role_id,
            status=(status or member.status).value,
        )
        if status == MembershipStatus.REMOVED:
            await self.repository.remove_member_grants(organization_id, user_id)
        await self._audit(
            organization_id,
            actor,
            "member.update",
            user_id,
            {
                "before": {"role_id": str(member.role_id), "status": member.status.value},
                "after": {
                    "role_id": str(role_id or member.role_id),
                    "status": (status or member.status).value,
                },
            },
        )
        await self._finish()

    async def transfer(
        self, organization_id: UUID, actor: OrganizationActor, next_owner_id: UUID
    ) -> None:
        self._require(actor, "organization.transfer")
        snapshot = await self.repository.lock_snapshot(organization_id)
        if not actor.is_owner:
            raise PermissionDeniedError("organization_owner_required")
        target = snapshot.member(next_owner_id)
        if (
            next_owner_id == actor.principal.user_id
            or target is None
            or target.status != MembershipStatus.ACTIVE
        ):
            raise ConflictError("different_owner_required", "다른 활성 구성원을 선택하세요.")
        await self.repository.transfer_ownership(
            organization_id,
            previous_owner_id=actor.principal.user_id,
            next_owner_id=next_owner_id,
        )
        await self._audit(organization_id, actor, "organization.transfer", next_owner_id)
        await self._finish()

    async def write_role(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        *,
        name: str,
        scope: RoleScope,
        permissions: list[str],
        role_id: UUID | None = None,
    ) -> UUID:
        self._require(actor, "role.update" if role_id else "role.create")
        snapshot = await self.repository.lock_snapshot(organization_id)
        keys = validate_role_write(
            scope=scope,
            permissions=permissions,
            actor_permissions=actor.permissions,
            actor_is_owner=actor.is_owner,
        )
        if role_id is not None:
            current = role_for(snapshot, role_id, scope)
            require_role_mutable(current, organization_id)
            require_delegation(
                current, actor_permissions=actor.permissions, actor_is_owner=actor.is_owner
            )
        saved = RoleRecord(role_id or uuid4(), organization_id, name, scope, keys)
        await self.repository.save_role(organization_id, saved)
        await self._audit(
            organization_id,
            actor,
            "role.update" if role_id else "role.create",
            saved.id,
            {"permissions": sorted(keys)},
        )
        await self._finish()
        return saved.id

    async def delete_role(
        self, organization_id: UUID, actor: OrganizationActor, role_id: UUID
    ) -> None:
        self._require(actor, "role.delete")
        snapshot = await self.repository.lock_snapshot(organization_id)
        role = role_for(
            snapshot,
            role_id,
            snapshot.role(role_id).scope if snapshot.role(role_id) else RoleScope.ORGANIZATION,
        )
        require_role_mutable(role, organization_id)
        require_delegation(role, actor_permissions=actor.permissions, actor_is_owner=actor.is_owner)
        require_role_unused(snapshot, role_id)
        await self.repository.delete_role(organization_id, role_id)
        await self._audit(organization_id, actor, "role.delete", role_id)
        await self._finish()

    async def set_workspace_member(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        workspace_id: UUID,
        user_id: UUID,
        role_id: UUID | None,
    ) -> None:
        snapshot = await self.repository.lock_snapshot(organization_id)
        target = snapshot.member(user_id)
        if target is None or (role_id is not None and target.status != MembershipStatus.ACTIVE):
            raise NotFoundError(
                "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다."
            )
        if workspace_id not in snapshot.active_workspace_ids:
            raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
        existing_role_id = snapshot.direct_workspace_roles.get(user_id, {}).get(workspace_id)
        active_owner_count = next(
            (
                counts[workspace_id]
                for counts in snapshot.active_workspace_owner_counts.values()
                if workspace_id in counts
            ),
            0,
        )
        if not actor.is_owner and "workspace.manage_members" not in (
            actor.workspace_permissions or {}
        ).get(workspace_id, frozenset()):
            raise PermissionDeniedError(
                "permission_required", "Permission required: workspace.manage_members"
            )
        workspace_permissions = (actor.workspace_permissions or {}).get(
            workspace_id, actor.permissions
        )
        for candidate in (existing_role_id, role_id):
            if candidate:
                require_delegation(
                    role_for(snapshot, candidate, RoleScope.WORKSPACE),
                    actor_permissions=workspace_permissions,
                    actor_is_owner=actor.is_owner,
                )
        validate_workspace_owner_removal(
            existing_role_id=existing_role_id,
            proposed_role_id=role_id,
            active_owner_count=active_owner_count,
            actor_is_owner=actor.is_owner,
        )
        await self.repository.set_workspace_member(organization_id, workspace_id, user_id, role_id)
        await self._audit(
            organization_id,
            actor,
            "workspace.member.update",
            user_id,
            {
                "workspace_id": str(workspace_id),
                "role_id": str(role_id) if role_id else None,
            },
        )
        await self._finish()

    async def write_team(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        *,
        name: str,
        description: str,
        team_id: UUID | None = None,
    ) -> UUID:
        self._require(actor, "team.update" if team_id else "team.create")
        snapshot = await self.repository.lock_snapshot(organization_id)
        current = next((team for team in snapshot.teams if team.id == team_id), None)
        if team_id is not None and current is None:
            raise NotFoundError("team_not_found", "팀을 찾을 수 없습니다.")
        team = TeamRecord(
            team_id or uuid4(),
            name,
            description,
            current.members if current else frozenset(),
            current.grants if current else (),
        )
        await self.repository.save_team(organization_id, team)
        await self._audit(
            organization_id, actor, "team.update" if team_id else "team.create", team.id
        )
        await self._finish()
        return team.id

    async def delete_team(
        self, organization_id: UUID, actor: OrganizationActor, team_id: UUID
    ) -> None:
        self._require(actor, "team.delete")
        snapshot = await self.repository.lock_snapshot(organization_id)
        team = next((item for item in snapshot.teams if item.id == team_id), None)
        if team is None:
            raise NotFoundError("team_not_found", "팀을 찾을 수 없습니다.")
        for grant in team.grants:
            workspace_permissions = (actor.workspace_permissions or {}).get(
                grant.workspace_id, actor.permissions
            )
            require_delegation(
                role_for(snapshot, grant.role_id, RoleScope.WORKSPACE),
                actor_permissions=workspace_permissions,
                actor_is_owner=actor.is_owner,
            )
        await self.repository.delete_team(organization_id, team_id)
        await self._audit(organization_id, actor, "team.delete", team_id)
        await self._finish()

    async def mutate_team_member(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        team_id: UUID,
        user_id: UUID,
        present: bool,
    ) -> None:
        self._require(actor, "team.manage_members")
        snapshot = await self.repository.lock_snapshot(organization_id)
        team = next((item for item in snapshot.teams if item.id == team_id), None)
        if team is None:
            raise NotFoundError("team_not_found", "팀을 찾을 수 없습니다.")
        member = snapshot.member(user_id)
        if member is None or (present and member.status != MembershipStatus.ACTIVE):
            raise NotFoundError(
                "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다."
            )
        for grant in team.grants:
            workspace_permissions = (actor.workspace_permissions or {}).get(
                grant.workspace_id, actor.permissions
            )
            require_delegation(
                role_for(snapshot, grant.role_id, RoleScope.WORKSPACE),
                actor_permissions=workspace_permissions,
                actor_is_owner=actor.is_owner,
            )
        await self.repository.set_team_member(organization_id, team_id, user_id, present)
        await self._audit(
            organization_id,
            actor,
            "team.member.add" if present else "team.member.remove",
            team_id,
            {"user_id": str(user_id)},
        )
        await self._finish()

    async def set_team_workspace(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        team_id: UUID,
        workspace_id: UUID,
        role_id: UUID | None,
    ) -> None:
        self._require(actor, "team.update")
        snapshot = await self.repository.lock_snapshot(organization_id)
        team = next((item for item in snapshot.teams if item.id == team_id), None)
        if team is None:
            raise NotFoundError("team_not_found", "팀을 찾을 수 없습니다.")
        if workspace_id not in snapshot.active_workspace_ids:
            raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
        previous = next((item for item in team.grants if item.workspace_id == workspace_id), None)
        workspace_permissions = (actor.workspace_permissions or {}).get(
            workspace_id, actor.permissions
        )
        if not actor.is_owner and "workspace.manage_members" not in workspace_permissions:
            raise PermissionDeniedError(
                "permission_required", "Permission required: workspace.manage_members"
            )
        if role_id == WORKSPACE_OWNER_ROLE_ID:
            raise ApplicationError(
                "direct_owner_required", "작업공간 소유자는 개인에게 직접 지정하세요."
            )
        for candidate in (previous.role_id if previous else None, role_id):
            if candidate:
                require_delegation(
                    role_for(snapshot, candidate, RoleScope.WORKSPACE),
                    actor_permissions=workspace_permissions,
                    actor_is_owner=actor.is_owner,
                )
        await self.repository.set_team_workspace_grant(
            organization_id,
            team_id,
            WorkspaceGrant(workspace_id, role_id) if role_id else None,
            workspace_id,
        )
        await self._audit(
            organization_id,
            actor,
            "team.workspace.update",
            team_id,
            {
                "workspace_id": str(workspace_id),
                "role_id": str(role_id) if role_id else None,
            },
        )
        await self._finish()

    async def invite(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        *,
        email: str,
        role_id: UUID,
        grants: tuple[WorkspaceGrant, ...],
    ) -> tuple[UUID, datetime]:
        self._require(actor, "member.invite")
        self._require(actor, "role.assign")
        snapshot = await self.repository.lock_snapshot(organization_id)
        seen: set[UUID] = set()
        for grant in grants:
            if grant.workspace_id in seen:
                raise ApplicationError(
                    "duplicate_workspace_grant", "작업공간은 한 번만 선택하세요."
                )
            seen.add(grant.workspace_id)
            if not actor.is_owner and "workspace.manage_members" not in (
                actor.workspace_permissions or {}
            ).get(grant.workspace_id, frozenset()):
                raise PermissionDeniedError(
                    "permission_required", "Permission required: workspace.manage_members"
                )
        if any(
            invitation.pending
            and invitation.expires_at > self.clock.now()
            and invitation.email == email.strip().casefold()
            for invitation in snapshot.invitations
        ):
            raise ConflictError(
                "invitation_pending", "대기 중인 초대가 있습니다. 재전송을 이용하세요."
            )
        roles = tuple(
            (grant.workspace_id, role_for(snapshot, grant.role_id, RoleScope.WORKSPACE))
            for grant in grants
        )
        normalized = validate_invitation(
            snapshot,
            email=email,
            role_id=role_id,
            workspace_roles=roles,
            actor_permissions=actor.permissions,
            actor_is_owner=actor.is_owner,
        )
        invitation_id, token = uuid4(), self.tokens.new_token()
        expires_at = self.clock.now() + INVITATION_LIFETIME
        await self.repository.create_invitation(
            invitation_id=invitation_id,
            organization_id=organization_id,
            email=normalized,
            role_id=role_id,
            invited_by=actor.principal.user_id,
            grants=grants,
            digest=self.tokens.digest(token),
            expires_at=expires_at,
        )
        await self._audit(
            organization_id,
            actor,
            "member.invitation.create",
            invitation_id,
            {
                "email": normalized,
                "role_id": str(role_id),
                "workspace_grants": [
                    {"workspace_id": str(grant.workspace_id), "role_id": str(grant.role_id)}
                    for grant in grants
                ],
            },
        )
        await self._finish()
        # Delivery intentionally follows commit; a retryable invitation remains on failure.
        await self._deliver(normalized, organization_id, token)
        return invitation_id, expires_at

    async def resend_invitation(
        self, organization_id: UUID, actor: OrganizationActor, invitation_id: UUID
    ) -> datetime:
        self._require(actor, "member.invite")
        self._require(actor, "role.assign")
        snapshot = await self.repository.lock_snapshot(organization_id)
        invitation = next((item for item in snapshot.invitations if item.id == invitation_id), None)
        if invitation is None or not invitation.pending:
            raise ConflictError("invitation_closed", "재전송할 수 없는 초대입니다.")
        if invitation.role_id is None:
            raise ConflictError("invitation_closed", "재전송할 수 없는 초대입니다.")
        role = role_for(snapshot, invitation.role_id, RoleScope.ORGANIZATION)
        require_delegation(role, actor_permissions=actor.permissions, actor_is_owner=actor.is_owner)
        for grant in invitation.workspace_grants:
            workspace_permissions = (actor.workspace_permissions or {}).get(
                grant.workspace_id, frozenset()
            )
            if grant.workspace_id not in snapshot.active_workspace_ids:
                raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
            if not actor.is_owner and "workspace.manage_members" not in workspace_permissions:
                raise PermissionDeniedError(
                    "permission_required", "Permission required: workspace.manage_members"
                )
            require_delegation(
                role_for(snapshot, grant.role_id, RoleScope.WORKSPACE),
                actor_permissions=workspace_permissions,
                actor_is_owner=actor.is_owner,
            )
        token = self.tokens.new_token()
        expires_at = self.clock.now() + INVITATION_LIFETIME
        await self.repository.replace_invitation_token(
            invitation_id,
            digest=self.tokens.digest(token),
            expires_at=expires_at,
        )
        await self._audit(organization_id, actor, "member.invitation.resend", invitation_id)
        await self._finish()
        await self._deliver(invitation.email, organization_id, token)
        return expires_at

    async def cancel_invitation(
        self, organization_id: UUID, actor: OrganizationActor, invitation_id: UUID
    ) -> None:
        self._require(actor, "member.cancel_invite")
        snapshot = await self.repository.lock_snapshot(organization_id)
        invitation = next((item for item in snapshot.invitations if item.id == invitation_id), None)
        if invitation is None or invitation.accepted_at is not None:
            raise ConflictError("invitation_closed", "취소할 수 없는 초대입니다.")
        await self.repository.cancel_invitation(invitation_id, self.clock.now())
        await self._audit(organization_id, actor, "member.invitation.cancel", invitation_id)
        await self._finish()

    async def accept(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        *,
        token: str,
    ) -> None:
        snapshot = await self.repository.lock_snapshot(organization_id)
        invitation_id = await self.repository.find_invitation_id_by_digest(
            organization_id, self.tokens.digest(token)
        )
        invitation = next((item for item in snapshot.invitations if item.id == invitation_id), None)
        if invitation is None:
            raise ConflictError("invalid_invitation", "초대가 만료되었거나 사용할 수 없습니다.")
        if invitation.role_id is None:
            raise ConflictError("invalid_invitation", "초대가 만료되었거나 사용할 수 없습니다.")
        membership = snapshot.member(actor.principal.user_id)
        if membership is not None and membership.status != MembershipStatus.REMOVED:
            raise ConflictError("organization_member_exists", "이미 조직에 소속되어 있습니다.")
        authority = await self.repository.inviter_authority(
            organization_id,
            invitation.invited_by,
            tuple(grant.workspace_id for grant in invitation.workspace_grants),
        )
        if not authority.principal_active:
            raise PermissionDeniedError("inviter_inactive")
        inviter_still_authorized = {
            "member.invite",
            "role.assign",
        } <= authority.organization_permissions
        if inviter_still_authorized:
            try:
                require_delegation(
                    role_for(snapshot, invitation.role_id, RoleScope.ORGANIZATION),
                    actor_permissions=authority.organization_permissions,
                    actor_is_owner=authority.is_owner,
                )
                for grant in invitation.workspace_grants:
                    if grant.workspace_id not in authority.active_workspaces:
                        inviter_still_authorized = False
                        break
                    if (
                        not authority.is_owner
                        and "workspace.manage_members"
                        not in authority.workspace_permissions.get(grant.workspace_id, frozenset())
                    ):
                        inviter_still_authorized = False
                        break
                    require_delegation(
                        role_for(snapshot, grant.role_id, RoleScope.WORKSPACE),
                        actor_permissions=authority.workspace_permissions.get(
                            grant.workspace_id, frozenset()
                        ),
                        actor_is_owner=authority.is_owner,
                    )
            except PermissionDeniedError:
                inviter_still_authorized = False
        validate_invitation_acceptance(
            invitation_email=invitation.email,
            principal_email=actor.principal.email,
            pending=invitation.pending,
            expires_at=invitation.expires_at,
            now=self.clock.now(),
            inviter_still_authorized=inviter_still_authorized,
        )
        await self.repository.accept_invitation(
            invitation.id, user_id=actor.principal.user_id, accepted_at=self.clock.now()
        )
        await self._audit(organization_id, actor, "member.invitation.accept", invitation.id)
        await self._finish()

    async def workspace_options(
        self, organization_id: UUID, actor: OrganizationActor
    ) -> list[WorkspaceOptionProjection]:
        self._require(actor, "member.read")
        options = await self.repository.list_workspace_options(organization_id)
        return [
            WorkspaceOptionProjection(
                id=option["id"],
                name=option["name"],
                permissions=sorted(
                    (actor.workspace_permissions or {}).get(option["id"], frozenset())
                ),
            )
            for option in options
            if actor.is_owner
            or "workspace.manage_members"
            in (actor.workspace_permissions or {}).get(option["id"], frozenset())
        ]

    async def audit_events(
        self, organization_id: UUID, actor: OrganizationActor
    ) -> list[dict[str, object]]:
        self._require(actor, "organization.read")
        if not actor.is_owner:
            self._require(actor, "member.update_role")
        return await self.repository.list_audit(organization_id)

    async def overview(self, organization_id: UUID, actor: OrganizationActor) -> dict[str, object]:
        self._require(actor, "organization.read")
        organization = await self.repository.get_organization(organization_id)
        if organization is None:
            raise PermissionDeniedError(
                "permission_required", "Permission required: organization.read"
            )
        return {
            "id": organization.id,
            "name": organization.name,
            "slug": organization.slug,
            "is_personal": organization.is_personal,
            "revision": organization.revision,
            "permissions": sorted(actor.permissions),
            "is_owner": actor.is_owner,
        }

    async def members(
        self,
        organization_id: UUID,
        actor: OrganizationActor,
        *,
        search: str = "",
        status: MembershipStatus | None = None,
    ) -> list[MemberProjection]:
        self._require(actor, "member.read")
        return await self.repository.list_members(
            organization_id, search=search, status=status.value if status else None
        )

    async def member_detail(
        self, organization_id: UUID, actor: OrganizationActor, user_id: UUID
    ) -> MemberDetailProjection:
        self._require(actor, "member.read")
        result = await self.repository.member_detail(organization_id, user_id)
        if result is None:
            raise NotFoundError(
                "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다."
            )
        return result

    async def roles(self, organization_id: UUID, actor: OrganizationActor) -> list[RoleProjection]:
        self._require(actor, "role.read")
        return await self.repository.list_roles(organization_id)

    async def teams(self, organization_id: UUID, actor: OrganizationActor) -> list[TeamProjection]:
        self._require(actor, "team.read")
        return await self.repository.list_teams(organization_id)

    async def invitations(
        self, organization_id: UUID, actor: OrganizationActor
    ) -> list[InvitationProjection]:
        self._require(actor, "member.invite")
        return await self.repository.list_invitations(organization_id, self.clock.now())
