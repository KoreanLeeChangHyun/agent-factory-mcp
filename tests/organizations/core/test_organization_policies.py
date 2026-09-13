from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from agent_factory_core.organizations.domain import (
    InvitationRecord,
    MemberRecord,
    MembershipStatus,
    OrganizationRecord,
    OrganizationSnapshot,
    RoleRecord,
    RoleScope,
)
from agent_factory_core.organizations.policies import (
    normalize_email,
    organization_slug,
    require_delegation,
    require_role_mutable,
    require_role_unused,
    validate_invitation_acceptance,
    validate_member_change,
    validate_workspace_owner_removal,
)
from agent_factory_core.organizations.system_roles import (
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from agent_factory_core.shared.errors import ConflictError, PermissionDeniedError

NOW = datetime(2026, 9, 12, tzinfo=UTC)
ORGANIZATION_ID = uuid4()
OWNER_ID = uuid4()


def member(user_id=OWNER_ID, role_id=ORGANIZATION_OWNER_ROLE_ID, status=MembershipStatus.ACTIVE):
    return MemberRecord(user_id, "owner@example.com", "Owner", role_id, status, NOW)


def snapshot(*members, counts=None, invitations=()):
    return OrganizationSnapshot(
        OrganizationRecord(ORGANIZATION_ID, "Example", "example", False, 1),
        tuple(members),
        invitations=tuple(invitations),
        active_workspace_owner_counts={OWNER_ID: counts or {}},
    )


def test_slug_and_email_are_deterministic() -> None:
    assert organization_slug("Demo Team", None, ORGANIZATION_ID).startswith("demo-team-")
    assert organization_slug("Demo", "kept", ORGANIZATION_ID) == "kept"
    assert normalize_email("  Person@Example.COM ") == "person@example.com"


def test_delegate_checks_owner_only_and_permission_subset() -> None:
    owner_role = RoleRecord(
        WORKSPACE_OWNER_ROLE_ID,
        None,
        "Owner",
        RoleScope.WORKSPACE,
        frozenset({"workspace.read"}),
        True,
    )
    with pytest.raises(PermissionDeniedError, match="owner_assignment_required"):
        require_delegation(
            owner_role, actor_permissions=frozenset({"workspace.read"}), actor_is_owner=False
        )
    custom = RoleRecord(
        uuid4(),
        ORGANIZATION_ID,
        "Custom",
        RoleScope.ORGANIZATION,
        frozenset({"member.read", "member.invite"}),
    )
    with pytest.raises(PermissionDeniedError, match="delegation_exceeds_permissions"):
        require_delegation(
            custom, actor_permissions=frozenset({"member.read"}), actor_is_owner=False
        )


def test_last_organization_and_workspace_owner_are_protected() -> None:
    state = snapshot(member(), counts={uuid4(): 1})
    with pytest.raises(ConflictError, match="last_organization_owner"):
        validate_member_change(
            state, OWNER_ID, next_role_id=uuid4(), next_status=None, actor_is_owner=True
        )
    ordinary_role = uuid4()
    state = snapshot(member(role_id=ordinary_role), counts={uuid4(): 1})
    with pytest.raises(ConflictError, match="last_workspace_owner"):
        validate_member_change(
            state,
            OWNER_ID,
            next_role_id=None,
            next_status=MembershipStatus.SUSPENDED,
            actor_is_owner=True,
        )
    with pytest.raises(ConflictError, match="last_workspace_owner"):
        validate_workspace_owner_removal(
            existing_role_id=WORKSPACE_OWNER_ROLE_ID,
            proposed_role_id=None,
            active_owner_count=1,
            actor_is_owner=True,
        )


def test_removed_member_requires_new_invitation() -> None:
    state = snapshot(member(status=MembershipStatus.REMOVED))
    with pytest.raises(ConflictError, match="member_reinvite_required"):
        validate_member_change(
            state,
            OWNER_ID,
            next_role_id=None,
            next_status=MembershipStatus.ACTIVE,
            actor_is_owner=True,
        )


def test_system_and_in_use_roles_cannot_be_changed_or_deleted() -> None:
    system = RoleRecord(uuid4(), None, "System", RoleScope.ORGANIZATION, frozenset(), True)
    with pytest.raises(PermissionDeniedError, match="system_role_immutable"):
        require_role_mutable(system, ORGANIZATION_ID)
    active = InvitationRecord(
        uuid4(),
        ORGANIZATION_ID,
        "invitee@example.com",
        system.id,
        OWNER_ID,
        (),
        NOW + timedelta(days=1),
    )
    with pytest.raises(ConflictError, match="role_in_use"):
        require_role_unused(snapshot(member(), invitations=(active,)), system.id)


@pytest.mark.parametrize(
    ("email", "pending", "expires", "authorized", "code"),
    [
        ("other@example.com", True, NOW + timedelta(days=1), True, "invitation_email_mismatch"),
        ("owner@example.com", False, NOW + timedelta(days=1), True, "invalid_invitation"),
        ("owner@example.com", True, NOW, True, "invalid_invitation"),
        ("owner@example.com", True, NOW + timedelta(days=1), False, "inviter_authority_changed"),
    ],
)
def test_acceptance_revalidates_email_liveness_and_inviter(
    email, pending, expires, authorized, code
) -> None:
    with pytest.raises((ConflictError, PermissionDeniedError), match=code):
        validate_invitation_acceptance(
            invitation_email=email,
            principal_email="owner@example.com",
            pending=pending,
            expires_at=expires,
            now=NOW,
            inviter_still_authorized=authorized,
        )
