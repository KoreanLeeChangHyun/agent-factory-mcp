from __future__ import annotations

from collections.abc import AsyncIterable
from types import SimpleNamespace
from typing import Annotated
from uuid import UUID

from api.http.routes.knowledge.cloud import (
    CloudService,
    create_cloud_knowledge_router,
)
from agent_factory_core.knowledge.errors import KnowledgePermissionError
from fastapi import Cookie, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

ORGANIZATION = UUID("00000000-0000-4000-8000-000000000001")
WORKSPACE = UUID("00000000-0000-4000-8000-000000000002")
USER = UUID("00000000-0000-4000-8000-000000000003")
DOCUMENT = UUID("00000000-0000-4000-8000-000000000004")
UPLOAD = UUID("00000000-0000-4000-8000-000000000005")


class Cloud:
    async def import_bytes(self, actor, command, content):
        del command, content
        if "document.import" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.import is required")
        raise AssertionError("authorized import is outside this transport-boundary test")

    async def index(self, actor, *, document_id, revision_number):
        if "document.update" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.update is required")
        assert document_id == DOCUMENT
        assert revision_number == 2
        return 3

    async def search(self, actor, query, limit):
        del query, limit
        if "document.read" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "document.read is required")
        return []


class Delivery:
    uploaded = False

    async def upload(
        self, actor, upload_id: UUID, capability: str, chunks: AsyncIterable[bytes]
    ) -> None:
        assert "document.import" in actor.permissions
        assert upload_id == UPLOAD
        assert capability == "c" * 40
        assert b"".join([chunk async for chunk in chunks]) == b"payload"
        self.uploaded = True


def client() -> tuple[TestClient, Delivery]:
    cloud, delivery = Cloud(), Delivery()
    service = CloudService(
        cloud=cloud,  # type: ignore[arg-type]
        delivery=delivery,  # type: ignore[arg-type]
        packages=object(),  # type: ignore[arg-type]
    )

    def context(
        permissions: Annotated[str | None, Header(alias="X-Test-Permissions")] = None,
    ) -> SimpleNamespace:
        return SimpleNamespace(
            principal=SimpleNamespace(user_id=USER),
            scope=SimpleNamespace(organization_id=ORGANIZATION, workspace_id=WORKSPACE),
            permissions=frozenset((permissions or "").split(",")) - {""},
        )

    def csrf(
        authorization: Annotated[str | None, Header(alias="Authorization")] = None,
        header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        cookie: Annotated[str | None, Cookie(alias="agent_factory_csrf")] = None,
    ) -> None:
        if authorization and authorization.startswith("Bearer "):
            return
        if not header or header != cookie:
            raise HTTPException(403)

    app = FastAPI()
    app.include_router(create_cloud_knowledge_router(lambda: service, context, csrf))
    return TestClient(app), delivery


def test_cloud_routes_map_permissions_to_403_and_expose_lexical_index() -> None:
    browser, _ = client()
    prefix = f"/api/organizations/{ORGANIZATION}/workspaces/{WORKSPACE}/cloud-documents"

    forbidden = browser.post(
        f"{prefix}/search", json={"schema_version": "1", "query": "term", "limit": 20}
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["code"] == "permission_denied"

    forbidden_import = browser.post(
        f"{prefix}/imports",
        headers={"Authorization": "Bearer token"},
        json={
            "schema_version": "1",
            "idempotency_key": "permission-test",
            "expected_revision": 0,
            "title": "permission test",
            "slug": "permission-test",
            "document_type": "original",
            "filename": "test.md",
            "media_type": "text/markdown",
            "source_sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            "source_identity": "fixture:test.md",
            "collection_context": "controlled authorization fixture",
            "content_base64": "aGVsbG8=",
        },
    )
    assert forbidden_import.status_code == 403
    assert forbidden_import.json()["detail"]["code"] == "permission_denied"

    indexed = browser.post(
        f"{prefix}/index",
        headers={"Authorization": "Bearer token", "X-Test-Permissions": "document.update"},
        json={"schema_version": "1", "document_id": str(DOCUMENT), "revision_number": 2},
    )
    assert indexed.status_code == 200
    assert indexed.json() == {"chunks_indexed": 3}


def test_upload_put_requires_session_csrf_and_allows_scoped_bearer() -> None:
    browser, delivery = client()
    path = (
        f"/api/organizations/{ORGANIZATION}/workspaces/{WORKSPACE}/cloud-documents/"
        f"uploads/{UPLOAD}/content"
    )
    headers = {
        "X-Document-Upload-Capability": "c" * 40,
        "X-Test-Permissions": "document.import",
    }

    assert browser.put(path, headers=headers, content=b"payload").status_code == 403
    accepted = browser.put(
        path,
        headers={**headers, "Authorization": "Bearer token"},
        content=b"payload",
    )
    assert accepted.status_code == 200
    assert delivery.uploaded is True
