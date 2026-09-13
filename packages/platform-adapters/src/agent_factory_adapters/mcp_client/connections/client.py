from __future__ import annotations

from dataclasses import dataclass

import httpx
from agent_factory_adapters.http_connectors.providers.client import (
    Resolver,
    SafeProviderHttpClient,
    public_addresses,
)


@dataclass(frozen=True, slots=True)
class MCPProbeResult:
    reachable: bool
    status_code: int


class MCPConnectionProbe:
    """Credential-bearing probe for an administrator-configured MCP HTTPS endpoint."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        resolver: Resolver = public_addresses,
        max_response_bytes: int = 1_000_000,
    ) -> None:
        self.client = SafeProviderHttpClient(
            client,
            resolver=resolver,
            max_response_bytes=max_response_bytes,
            max_redirects=3,
        )

    async def probe(self, endpoint: str, bearer_token: str) -> MCPProbeResult:
        response = await self.client.request(
            "POST",
            endpoint,
            headers={"Authorization": f"Bearer {bearer_token}", "Content-Type": "application/json"},
            body=b'{"jsonrpc":"2.0","id":"connection-probe","method":"tools/list","params":{}}',
        )
        return MCPProbeResult(response.status_code < 500, response.status_code)
