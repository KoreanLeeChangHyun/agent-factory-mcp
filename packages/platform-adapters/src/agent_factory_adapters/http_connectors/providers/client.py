from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable, Mapping
from contextlib import AbstractAsyncContextManager, AsyncExitStack
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import SplitResult, urljoin, urlsplit, urlunsplit

import httpx
from agent_factory_core.shared.errors import ApplicationError


@dataclass(frozen=True, slots=True)
class ProviderResponse:
    status_code: int
    headers: Mapping[str, str]
    body: bytes


Resolver = Callable[[str, int], Awaitable[tuple[str, ...]]]
Cancellation = Callable[[], Awaitable[bool]]
RedirectClientFactory = Callable[[], AbstractAsyncContextManager[httpx.AsyncClient]]


class ProviderRequestBudget(Protocol):
    async def reserve(self, maximum_bytes: int) -> tuple[object, int]: ...
    async def settle(self, reservation: object, accepted_bytes: int) -> None: ...


class _PartialResponseError(Exception):
    def __init__(self, error: Exception, accepted_bytes: int) -> None:
        super().__init__(str(error))
        self.error = error
        self.accepted_bytes = accepted_bytes


async def public_addresses(host: str, port: int) -> tuple[str, ...]:
    rows = (
        await __import__("asyncio")
        .get_running_loop()
        .getaddrinfo(host, port, type=socket.SOCK_STREAM)
    )
    return tuple(dict.fromkeys(str(row[4][0]) for row in rows))


class SafeProviderHttpClient:
    """Bounded HTTPS client that rejects credentialed and non-public destinations."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        resolver: Resolver = public_addresses,
        max_response_bytes: int = 50_000_000,
        max_redirects: int = 3,
        budget: ProviderRequestBudget | None = None,
        cancelled: Cancellation | None = None,
        max_short_retry_after: int = 5,
        redirect_client_factory: RedirectClientFactory | None = None,
    ) -> None:
        self.client = client
        self.resolver = resolver
        self.max_response_bytes = max_response_bytes
        self.max_redirects = max_redirects
        self.budget = budget
        self.cancelled = cancelled
        self.max_short_retry_after = max_short_retry_after
        self.redirect_client_factory = redirect_client_factory or self._redirect_client

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        body: bytes | None = None,
        redirect_host_suffixes: tuple[str, ...] = (),
    ) -> ProviderResponse:
        for attempt in range(3):
            if self.cancelled and await self.cancelled():
                raise ApplicationError("collection_cancelled", "Collection was cancelled", 409)
            reservation: object | None = None
            allowance = self.max_response_bytes
            if self.budget is not None:
                reservation, allowance = await self.budget.reserve(self.max_response_bytes)
                if allowance <= 0:
                    raise ApplicationError(
                        "provider_byte_budget_exhausted", "Provider byte budget is exhausted", 413
                    )
            accepted = 0
            transport_error: httpx.HTTPError | None = None
            try:
                try:
                    response = await self._request_once(
                        method,
                        url,
                        headers=headers,
                        body=body,
                        redirect_host_suffixes=redirect_host_suffixes,
                        allowance=allowance,
                    )
                    accepted = len(response.body)
                except _PartialResponseError as error:
                    accepted = error.accepted_bytes
                    if isinstance(error.error, httpx.HTTPError):
                        transport_error = error.error
                    else:
                        raise error.error
                except httpx.HTTPError as error:
                    transport_error = error
            finally:
                if self.budget is not None and reservation is not None:
                    await self.budget.settle(reservation, accepted)
            if transport_error is not None:
                if attempt == 2:
                    raise ApplicationError(
                        "provider_retryable",
                        "Provider collection request failed",
                        502,
                        {"retryable": True, "retry_after": 0},
                    ) from transport_error
                await self._wait(0)
                continue
            retry_after = response.headers.get("retry-after", "")
            delay = int(retry_after) if retry_after.isdigit() else 0
            if (
                response.status_code not in {429, 500, 502, 503, 504}
                or attempt == 2
                or delay > self.max_short_retry_after
            ):
                return response
            await self._wait(delay)
        raise AssertionError("retry loop exhausted")

    async def _request_once(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None,
        body: bytes | None,
        redirect_host_suffixes: tuple[str, ...],
        allowance: int,
    ) -> ProviderResponse:
        current_url = url
        current_method = method
        current_body = body
        current_headers = dict(headers or {})
        original_origin = self._origin(url)
        async with AsyncExitStack() as redirect_clients:
            for redirect_count in range(self.max_redirects + 1):
                client = (
                    self.client
                    if redirect_count == 0
                    else await redirect_clients.enter_async_context(self.redirect_client_factory())
                )
                parsed, pinned_url, host_header = await self._pin(current_url)
                request_headers = {**current_headers, "Host": host_header}
                request = client.build_request(
                    current_method,
                    pinned_url,
                    headers=request_headers,
                    content=current_body,
                    extensions={"sni_hostname": parsed.hostname.encode("ascii")},
                )
                response = await client.send(request, stream=True, follow_redirects=False)
                try:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location or redirect_count == self.max_redirects:
                            raise ApplicationError(
                                "unsafe_provider_redirect",
                                "Provider redirect is not allowed",
                                422,
                            )
                        next_url = urljoin(current_url, location)
                        next_host = (urlsplit(next_url).hostname or "").lower()
                        if redirect_host_suffixes and not any(
                            next_host == suffix or next_host.endswith("." + suffix)
                            for suffix in redirect_host_suffixes
                        ):
                            raise ApplicationError(
                                "unsafe_provider_redirect",
                                "Provider redirect is not allowed",
                                422,
                            )
                        if self._origin(next_url) != original_origin:
                            for key in list(current_headers):
                                if key.lower() in {
                                    "authorization",
                                    "cookie",
                                    "proxy-authorization",
                                }:
                                    current_headers.pop(key)
                        if response.status_code == 303:
                            current_method, current_body = "GET", None
                        current_url = next_url
                        continue
                    chunks: list[bytes] = []
                    size = 0
                    try:
                        async for chunk in response.aiter_bytes():
                            if self.cancelled and await self.cancelled():
                                raise ApplicationError(
                                    "collection_cancelled", "Collection was cancelled", 409
                                )
                            next_size = size + len(chunk)
                            if next_size > allowance:
                                size = allowance
                                raise ApplicationError(
                                    "provider_response_too_large",
                                    "Provider response exceeds limit",
                                    413,
                                )
                            size = next_size
                            chunks.append(chunk)
                    except (ApplicationError, httpx.HTTPError) as error:
                        raise _PartialResponseError(error, size) from error
                    return ProviderResponse(
                        response.status_code, dict(response.headers), b"".join(chunks)
                    )
                finally:
                    await response.aclose()
        raise AssertionError("redirect loop exhausted")

    def _redirect_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self.client.timeout,
            follow_redirects=False,
            trust_env=False,
        )

    async def _wait(self, seconds: int) -> None:
        remaining = max(0.0, float(seconds))
        while remaining > 0:
            if self.cancelled and await self.cancelled():
                raise ApplicationError("collection_cancelled", "Collection was cancelled", 409)
            interval = min(0.25, remaining)
            await asyncio.sleep(interval)
            remaining -= interval

    async def _pin(self, url: str) -> tuple[SplitResult, str, str]:
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.port not in {None, 443}
        ):
            raise ApplicationError(
                "unsafe_provider_url", "Provider URL must be credential-free HTTPS", 422
            )
        addresses = await self.resolver(parsed.hostname, 443)
        if not addresses or any(not ipaddress.ip_address(value).is_global for value in addresses):
            raise ApplicationError(
                "unsafe_provider_destination", "Provider destination is not public", 422
            )
        selected = addresses[0]
        pinned_host = f"[{selected}]" if ":" in selected else selected
        return (
            parsed,
            urlunsplit(("https", pinned_host, parsed.path or "/", parsed.query, "")),
            parsed.hostname,
        )

    @staticmethod
    def _origin(url: str) -> tuple[str, str | None, int | None]:
        parsed = urlsplit(url)
        return parsed.scheme, parsed.hostname, parsed.port or 443
