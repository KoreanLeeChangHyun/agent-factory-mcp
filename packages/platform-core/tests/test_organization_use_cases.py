from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.identity import Principal
from agent_factory_core.organizations.domain import (
    OrganizationRecord,
    OrganizationSnapshot,
    RoleRecord,
    RoleScope,
)
from agent_factory_core.organizations.system_roles import ORGANIZATION_OWNER_ROLE_ID
from agent_factory_core.organizations.use_cases import OrganizationActor, OrganizationUseCases
from agent_factory_core.shared.errors import ApplicationError

NOW = datetime(2026, 9, 12, tzinfo=UTC)


class Clock:
    def now(self):
        return NOW


class Tokens:
    def new_token(self):
        return "one-time-secret"

    def digest(self, token):
        assert token == "one-time-secret"
        return b"d" * 32


class Email:
    def __init__(self, events, fail=False):
        self.events = events
        self.fail = fail

    async def send_organization_invitation(self, email, organization_id, token):
        self.events.append(("email", email, organization_id, token))
        if self.fail:
            raise RuntimeError("controlled sink failure")


class Repository:
    def __init__(self, snapshot):
        self.snapshot = snapshot
        self.events = []

    async def lock_snapshot(self, organization_id):
        self.events.append(("lock", organization_id))
        return self.snapshot

    async def create_with_owner(self, **values):
        self.events.append(("create", values))

    async def create_invitation(self, **values):
        self.events.append(("invitation", values))

    async def append_audit(self, **values):
        self.events.append(("audit", values))

    async def commit(self):
        self.events.append(("commit",))

    async def rollback(self):
        self.events.append(("rollback",))


def actor(*permissions):
    return OrganizationActor(
        Principal(uuid4(), "owner@example.com", "Owner", False),
        frozenset(permissions),
        True,
    )


@pytest.mark.asyncio
async def test_create_persists_owner_and_audit_in_one_transaction() -> None:
    organization_id = uuid4()
    repository = Repository(
        OrganizationSnapshot(OrganizationRecord(organization_id, "A", "a", False, 1))
    )
    service = OrganizationUseCases(repository, Clock(), Tokens(), Email(repository.events))

    created = await service.create(actor(), "Example Team", None)

    assert created.id != organization_id
    assert [event[0] for event in repository.events] == ["create", "audit", "commit"]
    assert repository.events[0][1]["owner_id"] is not None


@pytest.mark.asyncio
async def test_invitation_commits_before_controlled_delivery_failure() -> None:
    organization_id = uuid4()
    role = RoleRecord(
        ORGANIZATION_OWNER_ROLE_ID,
        None,
        "organization_owner",
        RoleScope.ORGANIZATION,
        frozenset({"member.invite"}),
        True,
    )
    repository = Repository(
        OrganizationSnapshot(OrganizationRecord(organization_id, "A", "a", False, 1), roles=(role,))
    )
    email = Email(repository.events, fail=True)
    service = OrganizationUseCases(repository, Clock(), Tokens(), email)

    with pytest.raises(ApplicationError, match="invitation_delivery_failed"):
        await service.invite(
            organization_id,
            actor("member.invite", "role.assign"),
            email="  Invitee@Example.COM ",
            role_id=role.id,
            grants=(),
        )

    names = [event[0] for event in repository.events]
    assert names == ["lock", "invitation", "audit", "commit", "email"]
    invitation = repository.events[1][1]
    assert invitation["email"] == "invitee@example.com"
    assert invitation["digest"] == b"d" * 32
