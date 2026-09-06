"""Provider-only HTTP transport with bounded retries and credential isolation."""

import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit, urljoin

import httpx


class ProviderError(RuntimeError):
    def __init__(self, code: str, *, retryable: bool = False, retry_after: float = 0):
        super().__init__(code)
        self.code, self.retryable, self.retry_after = code, retryable, retry_after


class CollectionCancelled(RuntimeError):
    pass


async def never_cancelled():
    return False


class ProviderHTTP:
    def __init__(self, client: httpx.AsyncClient, *, cancelled=never_cancelled,
                 sleep: Callable[[float], Awaitable] = asyncio.sleep, max_bytes=50_000_000,
                 download_client_factory=None):
        self.client, self.cancelled, self.sleep = client, cancelled, sleep
        self.max_bytes = max_bytes
        self.bytes_read = 0
        self.account_bytes = None
        self.download_client_factory = download_client_factory or (
            lambda: httpx.AsyncClient(trust_env=False, follow_redirects=False))

    async def check_cancelled(self):
        if await self.cancelled():
            raise CollectionCancelled('collection_cancelled')

    async def request(self, method, url, *, headers=None, params=None, data=None,
                      json=None, auth=None, allow_redirect=False, client=None, extensions=None):
        for attempt in range(3):
            await self.check_cancelled()
            if self.bytes_read >= self.max_bytes:
                raise ProviderError('collection_byte_limit')
            # Reserve the entire remaining allowance before socket I/O. If the
            # process disappears, persisted accounting keeps that reservation.
            if self.account_bytes:
                await self.account_bytes(self.max_bytes)
            try:
                async with (client or self.client).stream(method, url, headers=headers, params=params,
                                              data=data, json=json, auth=auth,
                                              follow_redirects=False, timeout=60, extensions=extensions) as response:
                    if response.status_code == 429 or response.status_code >= 500:
                        try:
                            delay = max(1, float(response.headers.get('Retry-After', 2 ** attempt)))
                        except ValueError:
                            delay = 2 ** attempt
                        if delay > 30 or attempt == 2:
                            raise ProviderError('provider_rate_limited' if response.status_code == 429
                                                else 'provider_unavailable', retryable=True, retry_after=delay)
                        # Cancellation remains responsive during provider backoff.
                        for _ in range(int(delay) + 1):
                            await self.check_cancelled()
                            await self.sleep(1)
                        continue
                    if response.status_code in (301, 302, 303, 307, 308):
                        if allow_redirect:
                            return response.status_code, dict(response.headers), b''
                        raise ProviderError('provider_redirect_rejected')
                    if response.status_code >= 400:
                        raise ProviderError('provider_unauthorized' if response.status_code == 401 else
                                            'provider_forbidden' if response.status_code == 403 else
                                            'provider_not_found' if response.status_code == 404 else 'provider_request_rejected')
                    chunks = []
                    async for chunk in response.aiter_bytes():
                        await self.check_cancelled()
                        if len(chunk) > self.max_bytes - self.bytes_read:
                            self.bytes_read = self.max_bytes
                            raise ProviderError('collection_byte_limit')
                        self.bytes_read += len(chunk)
                        chunks.append(chunk)
                    return response.status_code, dict(response.headers), b''.join(chunks)
            except httpx.TransportError:
                if attempt == 2:
                    raise ProviderError('provider_network_error', retryable=True) from None
                await self.sleep(2 ** attempt)
            finally:
                if self.account_bytes:
                    await self.account_bytes(self.bytes_read)
        raise ProviderError('provider_unavailable', retryable=True)

    async def json(self, method, url, **kwargs):
        import json
        _, headers, content = await self.request(method, url, **kwargs)
        try:
            body = json.loads(content)
        except (ValueError, UnicodeDecodeError):
            raise ProviderError('provider_invalid_json') from None
        if isinstance(body, dict) and body.get('ok') is False:
            error = body.get('error')
            raise ProviderError('provider_unauthorized' if error in ('invalid_auth', 'token_revoked', 'not_authed')
                                else 'provider_forbidden' if error == 'missing_scope' else 'provider_request_rejected')
        return body, headers

    async def download(self, url, *, provider, token=None):
        """Consume only file URLs obtained by a bounded provider collector.

        Notion external objects may name arbitrary public HTTPS origins, but no
        public tool accepts URLs. Each hop is resolved, checked and pinned to a
        public IP while retaining its original Host and TLS SNI/certificate name.
        A fresh client per hop prevents cookies, auth, or pooled TLS identities
        crossing origins that happen to share an IP.
        """
        allowed = {
            'slack': ('files.slack.com',),
            'discord': ('cdn.discordapp.com', 'media.discordapp.net'),
            'notion': ('prod-files-secure.s3.us-west-2.amazonaws.com',
                       's3.us-west-2.amazonaws.com', 'file.notion.so'),
            'onedrive': ('files.1drv.com', 'onedrive.live.com', 'sharepoint.com'),
        }.get(provider, ())
        for hop in range(4):
            await self.check_cancelled()
            try:
                parsed = urlsplit(url)
                host = (parsed.hostname or '').encode('idna').decode('ascii')
                valid = (parsed.scheme == 'https' and host and not parsed.username
                         and not parsed.password and parsed.port in (None, 443)
                         and len(url) <= 8192 and not any(ord(char) < 33 for char in url))
            except (ValueError, UnicodeError):
                raise ProviderError('unsupported_attachment_host') from None
            if not valid or (provider != 'notion-external' and not any(
                    host == suffix or (provider == 'onedrive' and host.endswith('.' + suffix))
                    for suffix in allowed)):
                raise ProviderError('unsupported_attachment_host')
            try:
                addresses = await asyncio.wait_for(
                    asyncio.get_running_loop().getaddrinfo(host, 443, type=socket.SOCK_STREAM), timeout=10)
            except (OSError, TimeoutError):
                raise ProviderError('provider_dns_error', retryable=True) from None
            if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
                raise ProviderError('unsafe_attachment_address')
            pinned_url = httpx.URL(url).copy_with(host=addresses[0][4][0], fragment=None)
            headers = {'Host': host, 'Accept-Encoding': 'identity'}
            if provider == 'slack' and token:
                headers['Authorization'] = f'Bearer {token}'
            async with self.download_client_factory() as download_client:
                status, response_headers, content = await self.request(
                    'GET', pinned_url, headers=headers, client=download_client,
                    extensions={'sni_hostname': host}, allow_redirect=True)
            if status in (301, 302, 303, 307, 308):
                if hop == 3 or not response_headers.get('location'):
                    raise ProviderError('attachment_redirect_limit')
                url = urljoin(url, response_headers['location'])
                continue
            return content, response_headers.get('content-type', 'application/octet-stream').split(';')[0]
        raise ProviderError('attachment_redirect_limit')
