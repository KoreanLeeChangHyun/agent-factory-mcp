from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.identity import Principal
from agent_factory_core.workspaces import OrganizationSummary, WorkspaceRecord, WorkspaceStatus
from agent_factory_core.workspaces.use_cases import WorkspaceUseCases


class Locations:
    def canonicalize(self, location):
        return location


class Repository:
    def __init__(self, personal=None):
        self.personal = personal
        self.events = []

    async def lock_personal_provisioning(self, user_id):
        self.events.append(("advisory-lock", user_id))

    async def find_personal_organization(self, user_id):
        self.events.append(("find-personal", user_id))
        return self.personal

    async def create_personal_organization(self, **values):
        self.events.append(("create-personal", values))
        self.personal = OrganizationSummary(
            values["organization_id"], values["name"], values["slug"], True
        )
        return self.personal

    async def establish_organization_context(self, principal, organization_id):
        self.events.append(("restore-rls", principal.user_id, organization_id))

    async def create_workspace(self, **values):
        self.events.append(("create-workspace", values))
        now = datetime(2026, 9, 12, tzinfo=UTC)
        return WorkspaceRecord(
            values["workspace_id"],
            values["organization_id"],
            values["name"],
            values["slug"],
            WorkspaceStatus.ACTIVE,
            1,
            now,
            now,
        )

    async def commit(self):
        self.events.append(("commit",))

    async def rollback(self):
        self.events.append(("rollback",))


@pytest.mark.asyncio
@pytest.mark.parametrize("existing", [False, True])
async def test_personal_first_use_is_serialized_and_restores_rls(existing: bool) -> None:
    principal = Principal(uuid4(), "person@example.com", "Person", False)
    personal = (
        OrganizationSummary(uuid4(), "Personal", "personal-existing", True) if existing else None
    )
    repository = Repository(personal)
    service = WorkspaceUseCases(repository, Locations())

    workspace = await service.create_personal_workspace(principal, name="Project", slug="project")

    names = [event[0] for event in repository.events]
    assert names[0:2] == ["advisory-lock", "find-personal"]
    assert names[-3:] == ["restore-rls", "create-workspace", "commit"]
    assert ("create-personal" in names) is (not existing)
    assert workspace.organization_id == repository.personal.id
    assert repository.events[-2][1]["owner_user_id"] == principal.user_id
