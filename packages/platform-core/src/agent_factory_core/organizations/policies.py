"""Pure organization decisions shared by HTTP, MCP and worker composition."""

import re
from datetime import timedelta
from uuid import UUID

from agent_factory_core.shared.errors import ApplicationError, ConflictError, PermissionDeniedError

from .domain import MembershipStatus, OrganizationSnapshot, RoleRecord, RoleScope
from .permissions import validate_permissions
from .system_roles import ORGANIZATION_OWNER_ROLE_ID, WORKSPACE_OWNER_ROLE_ID

INVITATION_LIFETIME = timedelta(days=7)


def normalize_email(email: str) -> str:
    return email.strip().casefold()


def organization_slug(name: str, explicit: str | None, organization_id: UUID) -> str:
    if explicit:
        return explicit
    base = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")[:30].rstrip("-")
    return f"{base or 'organization'}-{organization_id.hex[:8]}"


def role_for(snapshot: OrganizationSnapshot, role_id: UUID, scope: RoleScope) -> RoleRecord:
    role = snapshot.role(role_id)
    if (
        role is None
        or role.scope != scope
        or role.organization_id
        not in {
            None,
            snapshot.organization.id,
        }
    ):
        raise ApplicationError("invalid_role", "조직과 적용 범위에 맞는 역할을 선택하세요.")
    return role


def require_delegation(
    role: RoleRecord,
    *,
    actor_permissions: frozenset[str],
    actor_is_owner: bool,
) -> None:
    if actor_is_owner:
        return
    if role.id in {ORGANIZATION_OWNER_ROLE_ID, WORKSPACE_OWNER_ROLE_ID}:
        raise PermissionDeniedError(
            "owner_assignment_required", "소유자 역할은 조직 소유자만 부여할 수 있습니다."
        )
    if not role.permissions <= actor_permissions:
        raise PermissionDeniedError(
            "delegation_exceeds_permissions", "보유한 권한 범위에서만 위임할 수 있습니다."
        )


def validate_role_write(
    *,
    scope: RoleScope,
    permissions: list[str],
    actor_permissions: frozenset[str],
    actor_is_owner: bool,
) -> frozenset[str]:
    keys = frozenset(validate_permissions(scope.value, permissions))
    if not actor_is_owner and (scope == RoleScope.WORKSPACE or not keys <= actor_permissions):
        raise PermissionDeniedError("delegation_exceeds_permissions")
    return keys


def require_role_mutable(role: RoleRecord, organization_id: UUID) -> None:
    if role.is_system or role.organization_id != organization_id:
        raise PermissionDeniedError("system_role_immutable")


def require_role_unused(snapshot: OrganizationSnapshot, role_id: UUID) -> None:
    used = any(member.role_id == role_id for member in snapshot.members)
    used |= any(grant.role_id == role_id for team in snapshot.teams for grant in team.grants)
    used |= any(
        assigned == role_id
        for roles in snapshot.direct_workspace_roles.values()
        for assigned in roles.values()
    )
    used |= any(
        invitation.pending
        and (
            invitation.role_id == role_id
            or any(g.role_id == role_id for g in invitation.workspace_grants)
        )
        for invitation in snapshot.invitations
    )
    if used:
        raise ConflictError("role_in_use", "사용 중인 역할은 삭제할 수 없습니다.")


def validate_member_change(
    snapshot: OrganizationSnapshot,
    user_id: UUID,
    *,
    next_role_id: UUID | None,
    next_status: MembershipStatus | None,
    actor_is_owner: bool,
) -> None:
    member = snapshot.member(user_id)
    if member is None:
        raise ApplicationError(
            "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다.", 404
        )
    if member.status == MembershipStatus.REMOVED and next_status not in {
        None,
        MembershipStatus.REMOVED,
    }:
        raise ConflictError("member_reinvite_required", "제거된 구성원은 다시 초대해야 합니다.")
    loses_active_owner = (
        member.status == MembershipStatus.ACTIVE
        and member.role_id == ORGANIZATION_OWNER_ROLE_ID
        and (
            (next_role_id is not None and next_role_id != member.role_id)
            or next_status in {MembershipStatus.SUSPENDED, MembershipStatus.REMOVED}
        )
    )
    if loses_active_owner:
        if not actor_is_owner:
            raise PermissionDeniedError("owner_management_required")
        owners = sum(
            item.status == MembershipStatus.ACTIVE and item.role_id == ORGANIZATION_OWNER_ROLE_ID
            for item in snapshot.members
        )
        if owners <= 1:
            raise ConflictError(
                "last_organization_owner", "마지막 조직 소유자는 변경하거나 제거할 수 없습니다."
            )
    if member.status == MembershipStatus.ACTIVE and next_status in {
        MembershipStatus.SUSPENDED,
        MembershipStatus.REMOVED,
    }:
        owner_counts = snapshot.active_workspace_owner_counts.get(user_id, {})
        if any(count <= 1 for count in owner_counts.values()):
            raise ConflictError(
                "last_workspace_owner",
                "먼저 해당 구성원의 작업공간 소유권을 다른 활성 구성원에게 배정하세요.",
            )


def validate_workspace_owner_removal(
    *,
    existing_role_id: UUID | None,
    proposed_role_id: UUID | None,
    active_owner_count: int,
    actor_is_owner: bool,
) -> None:
    if existing_role_id != WORKSPACE_OWNER_ROLE_ID or proposed_role_id == WORKSPACE_OWNER_ROLE_ID:
        return
    if not actor_is_owner:
        raise PermissionDeniedError("owner_management_required")
    if active_owner_count <= 1:
        raise ConflictError("last_workspace_owner", "마지막 작업공간 소유자는 제거할 수 없습니다.")


def validate_invitation(
    snapshot: OrganizationSnapshot,
    *,
    email: str,
    role_id: UUID,
    workspace_roles: tuple[tuple[UUID, RoleRecord], ...],
    actor_permissions: frozenset[str],
    actor_is_owner: bool,
) -> str:
    if snapshot.organization.is_personal:
        raise ApplicationError(
            "personal_organization_invitation", "공동 작업을 위한 조직을 먼저 만드세요."
        )
    normalized = normalize_email(email)
    if any(
        member.email.casefold() == normalized and member.status != MembershipStatus.REMOVED
        for member in snapshot.members
    ):
        raise ConflictError(
            "organization_member_exists",
            "이미 소속된 구성원입니다. 정지 상태는 구성원 화면에서 복구하세요.",
        )
    require_delegation(
        role_for(snapshot, role_id, RoleScope.ORGANIZATION),
        actor_permissions=actor_permissions,
        actor_is_owner=actor_is_owner,
    )
    for workspace_id, role in workspace_roles:
        if workspace_id not in snapshot.active_workspace_ids:
            raise ApplicationError("workspace_not_found", "작업공간을 찾을 수 없습니다.", 404)
        require_delegation(role, actor_permissions=actor_permissions, actor_is_owner=actor_is_owner)
    return normalized


def validate_invitation_acceptance(
    *,
    invitation_email: str,
    principal_email: str,
    pending: bool,
    expires_at,
    now,
    inviter_still_authorized: bool,
) -> None:
    if not pending or expires_at <= now:
        raise ConflictError("invalid_invitation", "초대가 만료되었거나 사용할 수 없습니다.")
    if normalize_email(invitation_email) != normalize_email(principal_email):
        raise PermissionDeniedError(
            "invitation_email_mismatch", "초대받은 이메일 계정으로 로그인하세요."
        )
    if not inviter_still_authorized:
        raise PermissionDeniedError(
            "inviter_authority_changed", "초대한 사람의 현재 권한을 확인할 수 없습니다."
        )
