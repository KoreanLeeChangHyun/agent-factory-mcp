from collections.abc import Iterator

import httpx
import pytest
from agent_factory_adapters.http_connectors.providers.client import SafeProviderHttpClient
from agent_factory_adapters.mcp_client.connections.client import MCPConnectionProbe
from agent_factory_core.shared.errors import ApplicationError


def resolver(*answers: tuple[str, ...]):
    remaining: Iterator[tuple[str, ...]] = iter(answers)

    async def resolve(host: str, port: int) -> tuple[str, ...]:
        return next(remaining)

    return resolve


class Budget:
    def __init__(self, allowances: list[int]) -> None:
        self.allowances = allowances
        self.reservations: list[object] = []
        self.settlements: list[tuple[object, int]] = []

    async def reserve(self, maximum_bytes: int) -> tuple[object, int]:
        reservation = object()
        self.reservations.append(reservation)
        return reservation, self.allowances.pop(0)

    async def settle(self, reservation: object, accepted_bytes: int) -> None:
        self.settlements.append((reservation, accepted_bytes))


class CancelAfterFirstChunk(httpx.AsyncByteStream):
    def __init__(self, mark_cancelled) -> None:
        self.mark_cancelled = mark_cancelled

    async def __aiter__(self):
        yield b"first"
        self.mark_cancelled()
        yield b"second"


class FailAfterFirstChunk(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b"first"
        raise httpx.ReadError("stream closed")


class TwoChunks(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b"first"
        yield b"second"


@pytest.mark.asyncio
async def test_provider_connects_to_validated_ip_with_host_and_sni() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "93.184.216.34"
        assert request.headers["host"] == "provider.example"
        assert request.extensions["sni_hostname"] == b"provider.example"
        return httpx.Response(200, content=b"ok")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        response = await SafeProviderHttpClient(
            client, resolver=resolver(("93.184.216.34",))
        ).request("GET", "https://provider.example/data")
    assert response.body == b"ok"


@pytest.mark.asyncio
async def test_provider_reservation_is_settled_conservatively_after_transport_failure() -> None:
    budget = Budget([100, 100, 100])

    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadError("closed", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ApplicationError, match="provider_retryable"):
            await SafeProviderHttpClient(
                client,
                resolver=resolver(
                    ("93.184.216.34",),
                    ("93.184.216.34",),
                    ("93.184.216.34",),
                ),
                budget=budget,
            ).request("GET", "https://provider.example/data")

    assert [accepted for _, accepted in budget.settlements] == [0, 0, 0]


@pytest.mark.asyncio
async def test_provider_settles_bytes_accepted_before_stream_transport_failure() -> None:
    budget = Budget([100, 100, 100])

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, stream=FailAfterFirstChunk())

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ApplicationError, match="provider_retryable"):
            await SafeProviderHttpClient(
                client,
                resolver=resolver(
                    ("93.184.216.34",),
                    ("93.184.216.34",),
                    ("93.184.216.34",),
                ),
                budget=budget,
            ).request("GET", "https://provider.example/data")

    assert [accepted for _, accepted in budget.settlements] == [5, 5, 5]


@pytest.mark.asyncio
async def test_provider_settles_bytes_accepted_before_over_limit_rejection() -> None:
    budget = Budget([7])

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, stream=TwoChunks())

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ApplicationError, match="provider_response_too_large"):
            await SafeProviderHttpClient(
                client, resolver=resolver(("93.184.216.34",)), budget=budget
            ).request("GET", "https://provider.example/data")

    assert budget.settlements == [(budget.reservations[0], 7)]


@pytest.mark.asyncio
async def test_provider_stops_before_io_when_durable_budget_is_exhausted() -> None:
    budget = Budget([0])
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ApplicationError, match="provider_byte_budget_exhausted"):
            await SafeProviderHttpClient(
                client, resolver=resolver(("93.184.216.34",)), budget=budget
            ).request("GET", "https://provider.example/data")

    assert calls == 0
    assert budget.settlements == []


@pytest.mark.asyncio
async def test_provider_checks_cancellation_between_streamed_chunks() -> None:
    cancelled = False
    budget = Budget([100])

    def mark_cancelled() -> None:
        nonlocal cancelled
        cancelled = True

    async def is_cancelled() -> bool:
        return cancelled

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, stream=CancelAfterFirstChunk(mark_cancelled))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ApplicationError, match="collection_cancelled"):
            await SafeProviderHttpClient(
                client,
                resolver=resolver(("93.184.216.34",)),
                budget=budget,
                cancelled=is_cancelled,
            ).request("GET", "https://provider.example/data")

    assert budget.settlements == [(budget.reservations[0], 5)]


@pytest.mark.asyncio
async def test_provider_short_retries_reserve_and_account_each_attempt_once() -> None:
    budget = Budget([100, 100, 100])
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            503 if calls < 3 else 200,
            headers={"retry-after": "0"},
            content=b"attempt",
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        response = await SafeProviderHttpClient(
            client,
            resolver=resolver(
                ("93.184.216.34",),
                ("93.184.216.34",),
                ("93.184.216.34",),
            ),
            budget=budget,
        ).request("GET", "https://provider.example/data")

    assert response.status_code == 200
    assert [accepted for _, accepted in budget.settlements] == [7, 7, 7]


@pytest.mark.asyncio
async def test_redirect_hop_rejects_private_dns_rebinding() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://provider.example/next"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = SafeProviderHttpClient(
            client,
            resolver=resolver(("93.184.216.34",), ("169.254.169.254",)),
        )
        with pytest.raises(ApplicationError, match="unsafe_provider_destination"):
            await adapter.request("GET", "https://provider.example/data")


@pytest.mark.asyncio
async def test_cross_origin_redirect_uses_fresh_cookie_free_client_on_same_ip() -> None:
    redirect_clients: list[httpx.AsyncClient] = []

    async def first_handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer secret"
        assert request.headers["cookie"] == "session=private"
        return httpx.Response(302, headers={"location": "https://files.example/download"})

    async def redirected_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "93.184.216.34"
        assert request.headers["host"] == "files.example"
        assert "authorization" not in request.headers
        assert "cookie" not in request.headers
        return httpx.Response(200, content=b"isolated")

    def redirect_client_factory() -> httpx.AsyncClient:
        client = httpx.AsyncClient(transport=httpx.MockTransport(redirected_handler))
        redirect_clients.append(client)
        return client

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(first_handler), cookies={"session": "private"}
    ) as client:
        response = await SafeProviderHttpClient(
            client,
            resolver=resolver(("93.184.216.34",), ("93.184.216.34",)),
            redirect_client_factory=redirect_client_factory,
        ).request(
            "GET",
            "https://api.example/data",
            headers={"Authorization": "Bearer secret"},
            redirect_host_suffixes=("example",),
        )

    assert response.body == b"isolated"
    assert len(redirect_clients) == 1
    assert redirect_clients[0] is not client


@pytest.mark.asyncio
async def test_mcp_probe_rejects_private_address_without_sending_token() -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        probe = MCPConnectionProbe(client, resolver=resolver(("127.0.0.1",)))
        with pytest.raises(ApplicationError, match="unsafe_provider_destination"):
            await probe.probe("https://mcp.example/rpc", "secret")
    assert calls == 0


@pytest.mark.asyncio
async def test_mcp_probe_pins_public_destination() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "93.184.216.34"
        assert request.headers["host"] == "mcp.example"
        assert request.headers["authorization"] == "Bearer secret"
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": "connection-probe"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await MCPConnectionProbe(client, resolver=resolver(("93.184.216.34",))).probe(
            "https://mcp.example/rpc", "secret"
        )
    assert result.reachable is True
