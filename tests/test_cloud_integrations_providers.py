"""Real provider collectors against recorded-shape HTTP responses; no live auth."""

import asyncio
import base64
import io
import json
import socket
import zipfile

import httpx
import pytest
import pytest_asyncio

from app.modules.integration.cloud_http import CollectionCancelled, ProviderError, ProviderHTTP
from app.modules.integration.cloud_oauth import OAuthConfig, authorization_url, token_request
from app.modules.integration.cloud_providers import CloudDriver
from app.modules.integration.cloud_schemas import Selection
from app.modules.integration.cloud_service import representation


@pytest_asyncio.fixture
async def public_dns(monkeypatch):
    async def resolve(*args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]
    monkeypatch.setattr(asyncio.get_running_loop(), 'getaddrinfo', resolve)


def response(body):
    return httpx.Response(200, json=body)


@pytest.mark.asyncio
async def test_drive_exports_native_files_and_keeps_folder_pagination():
    requests = []
    def handler(request):
        requests.append(request)
        assert request.headers['authorization'] == 'Bearer hidden'
        if request.url.path.endswith('/files'):
            if request.url.params.get('pageToken') == 'next':
                return response({'files': [{'id': 'sheet', 'name': 'Budget', 'mimeType': 'application/vnd.google-apps.spreadsheet'}]})
            return response({'nextPageToken': 'next', 'files': [{'id': 'doc', 'name': 'Brief', 'mimeType': 'application/vnd.google-apps.document'}]})
        if request.url.path.endswith('/doc/export'):
            assert request.url.params['mimeType'] == 'application/pdf'
            return httpx.Response(200, content=b'%PDF-source')
        assert request.url.params['mimeType'].endswith('spreadsheetml.sheet')
        return httpx.Response(200, content=b'xlsx-source')
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        driver = CloudDriver('google-drive', ProviderHTTP(client), {'access_token': 'hidden'})
        selection = Selection(folder_id='folder')
        first = await driver.page(selection, {}, 10)
        second = await driver.page(selection, first.cursor, 9)
    assert not first.done and second.done
    assert first.items[0].artifacts[0].content == b'%PDF-source'
    filename, mime, content = representation(second.items[0])
    assert mime == 'application/zip'
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert archive.read('000-Budget.xlsx') == b'xlsx-source'
    assert len(requests) == 4


@pytest.mark.asyncio
async def test_gmail_raw_message_and_original_attachment_bytes():
    raw = (b'From: sender@example.com\r\nSubject: Source mail\r\nMIME-Version: 1.0\r\n'
           b'Content-Type: multipart/mixed; boundary=x\r\n\r\n--x\r\nContent-Type: text/plain\r\n\r\nbody\r\n'
           b'--x\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="a.bin"\r\n'
           b'Content-Transfer-Encoding: base64\r\n\r\nAAEC\r\n--x--\r\n')
    def handler(request):
        if request.url.path.endswith('/messages'):
            assert request.url.params['q'] == 'from:sender@example.com'
            return response({'messages': [{'id': 'abc'}], 'nextPageToken': 'more'})
        assert request.url.params['format'] == 'raw'
        return response({'id': 'abc', 'threadId': 'thread', 'raw': base64.urlsafe_b64encode(raw).decode().rstrip('=')})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        page = await CloudDriver('gmail', ProviderHTTP(client), {'access_token': 'hidden'}).page(
            Selection(query='from:sender@example.com'), {}, 2)
    assert page.cursor == {'page': 'more'} and not page.done
    item = page.items[0]
    assert item.artifacts[0].content == raw
    assert item.artifacts[1].content == b'\x00\x01\x02'
    assert item.metadata['threadId'] == 'thread'
    assert item.metadata['headers']['Subject'] == 'Source mail'


@pytest.mark.asyncio
async def test_slack_bounded_history_files_and_private_url_redaction(public_dns):
    def handler(request):
        assert request.headers['authorization'] == 'Bearer hidden'
        if request.url.path.endswith('conversations.history'):
            assert request.url.params['channel'] == 'C123'
            assert request.url.params['oldest'] == '100.000001'
            return response({'ok': True, 'messages': [{'ts': '101.000001', 'text': 'source', 'files': [
                {'id': 'F1', 'url_private': 'https://files.slack.com/private?secret=1'}]}],
                'response_metadata': {'next_cursor': 'next'}})
        if request.url.path.endswith('files.info'):
            return response({'ok': True, 'file': {'name': 'attachment.txt', 'url_private_download': 'https://files.slack.com/download'}})
        assert request.headers['host'] == 'files.slack.com'
        assert request.url.host == '93.184.216.34'
        assert request.extensions['sni_hostname'] == 'files.slack.com'
        return httpx.Response(200, content=b'original attachment', headers={'content-type': 'text/plain'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        page = await CloudDriver('slack', ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))), {'access_token': 'hidden'}).page(
            Selection(channel_id='C123', oldest='100.000001'), {}, 20)
    assert page.items[0].artifacts[1].content == b'original attachment'
    assert b'url_private' not in page.items[0].artifacts[0].content
    assert page.items[0].source_id == 'C123:101.000001'
    assert page.cursor['page'] == 'next'


@pytest.mark.asyncio
async def test_notion_nested_blocks_fresh_hosted_and_external_files(public_dns):
    def handler(request):
        if request.url.host != 'api.notion.com':
            assert 'authorization' not in request.headers
            return httpx.Response(200, content=b'notion file')
        assert request.headers['notion-version'] == '2026-03-11'
        path = request.url.path
        if '/pages/' in path:
            return response({'id': 'page1', 'object': 'page'})
        if path.endswith('/page1/children'):
            return response({'results': [{'id': 'block1', 'has_children': True}], 'has_more': False})
        if path.endswith('/block1/children'):
            return response({'results': [], 'has_more': False})
        return response({'id': 'block1', 'type': 'file', 'file': {'type': 'file', 'file': {
            'url': 'https://prod-files-secure.s3.us-west-2.amazonaws.com/file?X-Amz-Signature=secret'}},
            'external_example': {'type': 'external', 'external': {'url': 'https://example.com/a?version=2'}}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        driver = CloudDriver('notion', ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))), {'access_token': 'hidden'})
        s = Selection(page_id='page1')
        page = await driver.page(s, {}, 10)
        blocks = await driver.page(s, page.cursor, 9)
        end = await driver.page(s, blocks.cursor, 8)
    assert end.done
    assert blocks.items[0].artifacts[1].content == b'notion file'
    assert b'X-Amz' not in blocks.items[0].artifacts[0].content
    assert blocks.items[0].artifacts[2].content == b'notion file'
    assert b'https://example.com/a?version=2' in blocks.items[0].artifacts[0].content
    assert blocks.items[0].metadata['external_sources'] == ['https://example.com/a?version=2']
    assert not blocks.items[0].limitations


@pytest.mark.asyncio
async def test_discord_pagination_uses_numeric_boundary_and_no_cdn_auth(public_dns):
    def handler(request):
        if request.url.host == 'discord.com':
            assert request.headers['authorization'] == 'Bot hidden'
            assert request.url.params['after'] == '8'
            return response([{'id': '10', 'content': 'source', 'attachments': [{'id': '55', 'filename': 'a.png',
                'url': 'https://cdn.discordapp.com/attachments/1/55/a.png?ex=secret',
                'proxy_url': 'https://media.discordapp.net/private'}]}, {'id': '9', 'attachments': []}])
        assert 'authorization' not in request.headers
        return httpx.Response(200, content=b'PNG', headers={'content-type': 'image/png'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        page = await CloudDriver('discord', ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))), {'access_token': 'hidden'}).page(
            Selection(channel_id='123', after='8'), {}, 2)
    assert page.cursor['page'] == '10'
    assert page.items[0].artifacts[1].content == b'PNG'
    assert b'ex=secret' not in page.items[0].artifacts[0].content
    assert b'proxy_url' not in page.items[0].artifacts[0].content


@pytest.mark.asyncio
async def test_onedrive_redirect_never_forwards_graph_credentials(public_dns):
    def handler(request):
        if request.url.host == 'graph.microsoft.com':
            assert request.headers['authorization'] == 'Bearer hidden'
            if request.url.path.endswith('/content'):
                return httpx.Response(302, headers={'location': 'https://tenant.sharepoint.com/download?token=secret'})
            return response({'id': 'item1', 'name': 'source.pdf', 'file': {'mimeType': 'application/pdf'},
                             '@microsoft.graph.downloadUrl': 'https://tenant.sharepoint.com/private?token=secret'})
        assert 'authorization' not in request.headers
        return httpx.Response(200, content=b'%PDF-onedrive', headers={'content-type': 'application/pdf'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        page = await CloudDriver('onedrive', ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))), {'access_token': 'hidden'}).page(
            Selection(item_id='item1'), {}, 1)
    assert page.done and page.items[0].artifacts[0].content == b'%PDF-onedrive'
    assert '@microsoft.graph.downloadUrl' not in page.items[0].metadata


@pytest.mark.asyncio
async def test_onedrive_rejects_cross_host_cursor_before_request():
    def handler(request):
        pytest.fail('unsafe cursor must not make HTTP requests')
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ProviderError, match='unsafe_provider_cursor'):
            await CloudDriver('onedrive', ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))), {'access_token': 'hidden'}).page(
                Selection(item_id='folder'), {'queue': ['folder'], 'page': 'https://evil.example/steal'}, 10)


@pytest.mark.asyncio
async def test_retry_after_and_cancellation_are_bounded():
    attempts, sleeps = [], []
    def handler(request):
        attempts.append(request)
        return httpx.Response(429, headers={'Retry-After': '1'}) if len(attempts) == 1 else response({'ok': True})
    async def sleep(seconds):
        sleeps.append(seconds)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = ProviderHTTP(client, sleep=sleep)
        body, _ = await transport.json('GET', 'https://slack.com/api/auth.test')
        assert body['ok'] and len(attempts) == 2 and sleeps
        async def cancelled():
            return True
        transport.cancelled = cancelled
        with pytest.raises(CollectionCancelled):
            await transport.json('GET', 'https://slack.com/api/auth.test')
    assert len(attempts) == 2


@pytest.mark.asyncio
async def test_download_rejects_private_or_arbitrary_hosts_without_token_forwarding():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: pytest.fail('no request allowed'))) as client:
        transport = ProviderHTTP(client)
        for url in ('http://files.slack.com/a', 'https://127.0.0.1/a', 'https://files.slack.com.evil.example/a',
                    'https://user:pass@files.slack.com/a', 'https://files.slack.com:444/a'):
            with pytest.raises(ProviderError):
                await transport.download(url, provider='slack', token='hidden')


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['google-drive', 'gmail', 'onedrive', 'slack', 'notion'])
async def test_confidential_oauth_code_exchange_and_refresh(provider):
    config = OAuthConfig('client', 'client-secret', 'https://cloud.example/oauth/callback')
    scopes = {'google-drive': ['https://www.googleapis.com/auth/drive.readonly'],
              'gmail': ['https://www.googleapis.com/auth/gmail.readonly'],
              'onedrive': ['Files.Read', 'offline_access'], 'slack': ['channels:history'], 'notion': []}[provider]
    url = authorization_url(provider, config, scopes, 'state', 'challenge')
    assert 'client-secret' not in url and 'state=state' in url
    assert 'localhost' not in url and 'device' not in url
    seen = []
    def handler(request):
        seen.append(request)
        body = request.content.decode()
        if provider == 'notion':
            assert request.headers['authorization'].startswith('Basic ')
        else:
            assert 'client_secret=client-secret' in body
        return response({'access_token': 'new-access', 'refresh_token': 'rotated-refresh', 'expires_in': 3600, 'scope': ' '.join(scopes)})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = ProviderHTTP(client)
        credentials = await token_request(transport, provider, config, code='code', verifier='verifier')
        refreshed = await token_request(transport, provider, config, refresh_token=credentials['refresh_token'])
    assert refreshed['refresh_token'] == 'rotated-refresh'
    assert len(seen) == 2 and b'rotated-refresh' in seen[1].content


def test_selections_reject_scope_widening_and_unrelated_provider_fields():
    with pytest.raises(ValueError):
        Selection().for_provider('gmail')
    with pytest.raises(ValueError):
        Selection(item_id='item', drive_id='shared').for_provider('onedrive')
    with pytest.raises(ValueError):
        Selection(channel_id='123', query='unused').for_provider('discord')
    with pytest.raises(ValueError):
        Selection(folder_id="x' or true")
    with pytest.raises(ValueError):
        Selection(channel_id='123', before='1', after='2')
    with pytest.raises(ValueError):
        Selection(max_items=0)


@pytest.mark.asyncio
async def test_external_notion_redirects_are_public_pinned_and_credential_free(public_dns):
    seen = []
    def handler(request):
        seen.append(request)
        assert request.url.host == '93.184.216.34'
        assert 'authorization' not in request.headers
        assert 'cookie' not in request.headers
        assert request.extensions['sni_hostname'] == request.headers['host']
        if request.headers['host'] == 'source.example':
            return httpx.Response(302, headers={'location': 'https://cdn.example/file.pdf?version=2',
                                               'set-cookie': 'secret=must-not-cross; Path=/'})
        assert request.headers['host'] == 'cdn.example'
        assert request.url.params['version'] == '2'
        return httpx.Response(200, content=b'original', headers={'content-type': 'application/pdf'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        http = ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        content, mime = await http.download('https://source.example/source?v=1', provider='notion-external', token='never-forward')
    assert content == b'original' and mime == 'application/pdf' and len(seen) == 2


@pytest.mark.asyncio
async def test_external_redirect_to_private_destination_is_rejected(monkeypatch):
    seen = []
    async def resolve(host, *args, **kwargs):
        address = '93.184.216.34' if host == 'public.example' else '169.254.169.254'
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (address, 443))]
    monkeypatch.setattr(asyncio.get_running_loop(), 'getaddrinfo', resolve)
    def handler(request):
        seen.append(request)
        return httpx.Response(302, headers={'location': 'https://metadata.example/credentials'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        http = ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        with pytest.raises(ProviderError, match='unsafe_attachment_address'):
            await http.download('https://public.example/file', provider='notion-external')
    assert len(seen) == 1


@pytest.mark.asyncio
async def test_external_download_redirect_and_byte_limits(public_dns):
    calls = []
    def redirect(request):
        calls.append(request)
        return httpx.Response(302, headers={'location': '/loop'})
    async with httpx.AsyncClient() as client:
        http = ProviderHTTP(client, download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(redirect)))
        with pytest.raises(ProviderError, match='attachment_redirect_limit'):
            await http.download('https://public.example/loop', provider='notion-external')
        assert len(calls) == 4
        http = ProviderHTTP(client, max_bytes=3, download_client_factory=lambda: httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, content=b'large'))))
        with pytest.raises(ProviderError, match='collection_byte_limit'):
            await http.download('https://public.example/file', provider='notion-external')
        assert http.bytes_read == 3


def test_source_redaction_retains_semantic_urls_and_removes_provider_secrets():
    from app.modules.integration.cloud_providers import evidence
    source = {'type': 'external', 'external': {'url': 'https://example.org/file.pdf?version=2&part=a%2Fb'}}
    assert evidence(source) == source
    signed = evidence({'url': 'https://bucket.s3.amazonaws.com/file?version=2&X-Amz-Signature=secret&X-Amz-Credential=key'})
    assert signed['url'] == 'https://bucket.s3.amazonaws.com/file?version=2'
    assert evidence({'type': 'file', 'file': {'url': 'https://provider.example/temporary?token=secret'}}) == {'type': 'file', 'file': {}}
    assert evidence({'url': 'https://cdn.discordapp.com/a?ex=secret&hm=signature&width=10'})['url'].endswith('?width=10')


@pytest.mark.asyncio
async def test_external_redirect_cancellation_stops_before_next_hop(public_dns):
    stopped = False
    calls = []
    async def cancelled():
        return stopped
    def handler(request):
        nonlocal stopped
        calls.append(request)
        stopped = True
        return httpx.Response(302, headers={'location': 'https://next.example/file'})
    async with httpx.AsyncClient() as client:
        http = ProviderHTTP(client, cancelled=cancelled,
            download_client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        with pytest.raises(CollectionCancelled):
            await http.download('https://source.example/file', provider='notion-external')
    assert len(calls) == 1
