import json

import pytest
from agent_factory_adapters.http_connectors.providers.client import ProviderResponse
from agent_factory_adapters.http_connectors.providers.drivers import (
    ProviderCollectionDriver,
    ProviderDriverError,
    sanitized_source_url,
)
from agent_factory_core.connections.providers.collection_domain import CollectionSelection


class Client:
    def __init__(self, payload, headers=None):
        self.payload = payload
        self.headers = headers or {}
        self.requests = []

    async def request(self, method, url, *, headers=None, body=None, **kwargs):
        self.requests.append((method, url, headers))
        return ProviderResponse(200, self.headers, json.dumps(self.payload).encode())


class ScriptedClient:
    def __init__(self, responses):
        self.responses = list(responses)

    async def request(self, method, url, *, headers=None, body=None, **kwargs):
        value = self.responses.pop(0)
        payload = value if isinstance(value, bytes) else json.dumps(value).encode()
        return ProviderResponse(200, {"content-type": "application/octet-stream"}, payload)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider", "payload", "expected"),
    [
        ("google-drive", {"user": {"permissionId": "drive-user"}}, "drive-user"),
        ("gmail", {"emailAddress": "user@example.test"}, "user@example.test"),
        ("slack", {"team_id": "T1", "ok": True}, "T1"),
        ("notion", {"id": "notion-user"}, "notion-user"),
        ("discord", {"id": "discord-user"}, "discord-user"),
        ("onedrive", {"id": "drive-id"}, "drive-id"),
    ],
)
async def test_six_provider_inspection_fixtures(provider, payload, expected) -> None:
    client = Client(payload, {"x-oauth-scopes": "channels:history,files:read"})
    driver = ProviderCollectionDriver(
        provider, client, {"access_token": "secret", "scope": "Files.Read"}
    )

    result = await driver.inspect()

    assert result["health"] == "available"
    assert result["account_id"] == expected
    assert "secret" not in client.requests[0][1]
    if provider == "slack":
        assert result["granted_scopes"] == ["channels:history", "files:read"]


@pytest.mark.asyncio
async def test_oauth_collection_blocks_when_observed_grants_are_unknown() -> None:
    driver = ProviderCollectionDriver("gmail", ScriptedClient([]), {"access_token": "secret"})

    with pytest.raises(ProviderDriverError, match="granted_scopes_unknown"):
        await driver.page(
            CollectionSelection({"query": "from:test"}),
            {},
            10,
            metadata_only=False,
        )


def test_source_url_redacts_provider_signatures_but_preserves_semantic_query() -> None:
    value = sanitized_source_url("https://cdn.discordapp.com/file?version=2&ex=secret&hm=signature")

    assert value == "https://cdn.discordapp.com/file?version=2"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider", "selection", "responses", "scope"),
    [
        (
            "google-drive",
            {"file_id": "file"},
            [{"id": "file", "name": "file.txt", "mimeType": "text/plain"}, b"body"],
            "https://www.googleapis.com/auth/drive.readonly",
        ),
        (
            "gmail",
            {"query": "from:test"},
            [{"messages": [{"id": "mail"}]}, {"id": "mail", "raw": "U3ViamVjdDogVGVzdAoKYm9keQ=="}],
            "https://www.googleapis.com/auth/gmail.readonly",
        ),
        (
            "slack",
            {"channel_id": "C1", "channel_type": "public"},
            [
                {
                    "messages": [{"ts": "1", "text": "hello"}],
                    "has_more": False,
                    "response_metadata": {},
                }
            ],
            "channels:history files:read",
        ),
        ("notion", {"page_id": "page"}, [{"id": "page"}], ""),
        (
            "discord",
            {"channel_id": "123"},
            [[{"id": "10", "content": "hello", "attachments": []}]],
            "",
        ),
        (
            "onedrive",
            {"item_id": "item"},
            [{"id": "item", "name": "file.txt", "file": {"mimeType": "text/plain"}}, b"body"],
            "Files.Read",
        ),
    ],
)
async def test_six_provider_collection_page_fixtures(provider, selection, responses, scope) -> None:
    driver = ProviderCollectionDriver(
        provider, ScriptedClient(responses), {"access_token": "secret", "scope": scope}
    )
    driver.observed_scopes = set(scope.split()) if scope else None

    page = await driver.page(CollectionSelection(selection), {}, 10, metadata_only=False)

    assert page.examined >= 1
    assert page.items
    assert page.items[0].source_id
