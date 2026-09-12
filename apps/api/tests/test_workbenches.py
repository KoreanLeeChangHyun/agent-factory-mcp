from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from agent_factory_adapters import ContractWorkbenchValidator
from agent_factory_api.http.routes.workbenches import WorkbenchService, create_workbench_router
from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE
from agent_factory_core import (
    CreateWorkbenchDefinition,
    GetWorkbenchDefinition,
    GetWorkbenchRelease,
    ListWorkbenchDefinitions,
    ListWorkbenchReleases,
    PublishWorkbenchDefinition,
    SetWorkbenchArchived,
    UpdateWorkbenchDefinition,
    WorkbenchActor,
    WorkbenchConflictError,
    WorkbenchDefinitionAggregate,
    WorkbenchDefinitionState,
    WorkbenchRelease,
    WorkbenchValidationError,
)
from fastapi import Cookie, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

USER = UUID("00000000-0000-4000-8000-000000000001")
ORGANIZATION = UUID("00000000-0000-4000-8000-000000000002")
WORKSPACE = UUID("00000000-0000-4000-8000-000000000003")


def test_server_validator_rejects_a_runtime_unknown_asset() -> None:
    definition = deepcopy(DOCUMENTS_FIXTURE)
    definition["panel"]["components"][0]["asset"] = "unknown-control@1"
    with pytest.raises(WorkbenchValidationError, match="unknown asset"):
        ContractWorkbenchValidator().validate(definition)


class Repository:
    def __init__(self) -> None:
        self.definition: WorkbenchDefinitionAggregate | None = None
        self.releases: list[WorkbenchRelease] = []

    async def list_definitions(self, actor, *, include_archived=False):
        if self.definition is None or (
            self.definition.state == WorkbenchDefinitionState.ARCHIVED and not include_archived
        ):
            return []
        return [self.definition]

    async def get_definition(self, actor, definition_id, *, include_archived=False):
        if (
            self.definition
            and self.definition.id == definition_id
            and (include_archived or self.definition.state == WorkbenchDefinitionState.DRAFT)
        ):
            return self.definition
        return None

    async def create_definition(self, actor: WorkbenchActor, *, key, title, validated):
        now = datetime.now(UTC)
        self.definition = WorkbenchDefinitionAggregate(
            uuid4(),
            actor.organization_id,
            actor.workspace_id,
            key,
            title,
            WorkbenchDefinitionState.DRAFT,
            1,
            deepcopy(dict(validated.definition)),
            None,
            actor.user_id,
            actor.user_id,
            now,
            now,
        )
        return self.definition

    async def update_definition(self, actor, definition_id, *, title, validated, expected_revision):
        assert self.definition
        if self.definition.revision != expected_revision:
            raise WorkbenchConflictError(self.definition.revision)
        self.definition = replace(
            self.definition,
            title=title,
            draft=deepcopy(dict(validated.definition)),
            revision=expected_revision + 1,
        )
        return self.definition

    async def set_archived(self, actor, definition_id, *, archived, expected_revision):
        assert self.definition
        if self.definition.revision != expected_revision:
            raise WorkbenchConflictError(self.definition.revision)
        self.definition = replace(
            self.definition,
            state=(
                WorkbenchDefinitionState.ARCHIVED if archived else WorkbenchDefinitionState.DRAFT
            ),
            revision=expected_revision + 1,
            archived_at=datetime.now(UTC) if archived else None,
        )
        return self.definition

    async def publish(
        self, actor, definition_id, *, validated, expected_revision, request_key, command_digest
    ):
        assert self.definition
        if self.definition.revision != expected_revision:
            raise WorkbenchConflictError(self.definition.revision)
        release = WorkbenchRelease(
            uuid4(),
            actor.organization_id,
            actor.workspace_id,
            definition_id,
            expected_revision,
            len(self.releases) + 1,
            validated.schema_version,
            validated.schema_digest,
            validated.asset_version,
            validated.definition_digest,
            deepcopy(dict(validated.definition)),
            actor.user_id,
            datetime.now(UTC),
        )
        self.releases.append(release)
        return release

    async def list_releases(self, actor, definition_id):
        return list(reversed(self.releases))

    async def get_release(self, actor, release_id):
        return next((release for release in self.releases if release.id == release_id), None)


def test_http_uses_revision_permissions_and_immutable_snapshot() -> None:
    repository = Repository()
    validator = ContractWorkbenchValidator()
    service = WorkbenchService(
        ListWorkbenchDefinitions(repository),
        GetWorkbenchDefinition(repository),
        CreateWorkbenchDefinition(repository, validator),
        UpdateWorkbenchDefinition(repository, validator),
        SetWorkbenchArchived(repository),
        PublishWorkbenchDefinition(repository, validator),
        ListWorkbenchReleases(repository),
        GetWorkbenchRelease(repository),
    )

    def context(permissions: str | None = Header(alias="X-Test-Permissions", default=None)):
        if permissions is None:
            raise HTTPException(401)
        return SimpleNamespace(
            principal=SimpleNamespace(user_id=USER),
            scope=SimpleNamespace(organization_id=ORGANIZATION, workspace_id=WORKSPACE),
            permissions=frozenset(permissions.split(",")),
        )

    def csrf(
        header: str | None = Header(alias="X-CSRF-Token", default=None),
        cookie: str | None = Cookie(alias="agent_factory_csrf", default=None),
    ):
        if not header or header != cookie:
            raise HTTPException(403)

    app = FastAPI()
    app.include_router(create_workbench_router(lambda: service, context, csrf))
    client = TestClient(app)
    path = f"/api/workspaces/{WORKSPACE}/workbenches"
    assert client.get(path).status_code == 401
    client.cookies.set("agent_factory_csrf", "csrf")
    write_headers = {
        "X-CSRF-Token": "csrf",
        "X-Test-Permissions": "workbench.read,workbench.preview,workbench.create,workbench.update,workbench.publish,workbench.archive,workbench.restore",
    }
    assert (
        client.post(
            path,
            headers=write_headers,
            json={"key": "INVALID", "title": "문서", "definition": DOCUMENTS_FIXTURE},
        ).status_code
        == 422
    )
    created = client.post(
        path,
        headers=write_headers,
        json={"key": "documents", "title": "문서", "definition": DOCUMENTS_FIXTURE},
    )
    assert created.status_code == 201
    definition_id = created.json()["id"]
    draft = client.get(f"{path}/{definition_id}/draft", headers=write_headers)
    assert draft.status_code == 200 and draft.headers["cache-control"] == "no-store"
    listing = client.get(path, headers={"X-Test-Permissions": "workbench.read"}).json()
    assert "definition" not in listing["items"][0]
    assert (
        client.get(
            f"{path}/{definition_id}/draft", headers={"X-Test-Permissions": "workbench.read"}
        ).status_code
        == 403
    )
    published = client.post(
        f"{path}/{definition_id}/publish",
        headers=write_headers,
        json={"expectedRevision": 1, "requestKey": "publish-1"},
    )
    assert published.status_code == 201
    snapshot = deepcopy(published.json()["definition"])
    assert dict(repository.releases[0].snapshot) == snapshot
    release_id = published.json()["id"]
    assert (
        client.get(f"{path}/{definition_id}/releases", headers=write_headers).json()["items"][0][
            "id"
        ]
        == release_id
    )
    assert (
        client.get(f"{path}/releases/{release_id}", headers=write_headers).json()["definition"]
        == snapshot
    )
    conflict = client.put(
        f"{path}/{definition_id}/draft",
        headers=write_headers,
        json={"title": "문서", "expectedRevision": 2, "definition": DOCUMENTS_FIXTURE},
    )
    assert conflict.status_code == 409
    archived = client.post(
        f"{path}/{definition_id}/archive",
        headers=write_headers,
        json={"expectedRevision": 1},
    )
    assert archived.status_code == 200 and archived.json()["state"] == "archived"
    assert client.get(path, headers=write_headers).json()["items"] == []
    assert (
        len(client.get(f"{path}?includeArchived=true", headers=write_headers).json()["items"]) == 1
    )
    restored = client.post(
        f"{path}/{definition_id}/restore",
        headers=write_headers,
        json={"expectedRevision": 2},
    )
    assert restored.status_code == 200 and restored.json()["state"] == "draft"
    assert client.get(f"{path}/not-a-uuid/draft", headers=write_headers).status_code == 422
