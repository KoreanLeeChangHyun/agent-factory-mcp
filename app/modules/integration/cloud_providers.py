"""Six read-only API collectors; pagination yields persistable source units."""

import base64
import copy
import email
import json
from dataclasses import dataclass, field
from urllib.parse import quote, urlsplit, parse_qs, parse_qsl, urlunsplit, urlencode

from app.modules.integration.cloud_http import ProviderError, ProviderHTTP
from app.modules.integration.cloud_schemas import Selection

DRIVE = 'https://www.googleapis.com/drive/v3'
GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
GRAPH = 'https://graph.microsoft.com/v1.0'
SLACK = 'https://slack.com/api'
NOTION = 'https://api.notion.com/v1'
DISCORD = 'https://discord.com/api/v10'
EXPORTS = {
    'application/vnd.google-apps.document': ('application/pdf', '.pdf'),
    'application/vnd.google-apps.spreadsheet': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'),
    'application/vnd.google-apps.presentation': ('application/pdf', '.pdf'),
    'application/vnd.google-apps.drawing': ('application/pdf', '.pdf'),
}


@dataclass
class Artifact:
    filename: str
    media_type: str
    content: bytes = field(repr=False)


@dataclass
class SourceItem:
    source_id: str
    title: str
    artifacts: list[Artifact]
    metadata: dict = field(default_factory=dict)
    limitations: list[str] = field(default_factory=list)


@dataclass
class Page:
    items: list[SourceItem]
    cursor: dict
    done: bool
    examined: int


def component(value):
    return quote(str(value), safe='')


def source_url(url):
    """Preserve semantic query parameters; strip known temporary signatures."""
    parsed = urlsplit(url)
    host = parsed.hostname or ''
    secret_keys = {'access_token', 'refresh_token', 'bearer_token', 'x-amz-signature', 'x-amz-credential', 'x-amz-security-token',
                   'x-amz-algorithm', 'x-amz-date', 'x-amz-expires', 'x-amz-signedheaders',
                   'x-goog-signature', 'x-goog-credential', 'x-goog-algorithm',
                   'x-goog-date', 'x-goog-expires', 'x-goog-signedheaders',
                   'awsaccesskeyid', 'googleaccessid'}
    if host.endswith(('.amazonaws.com', '.cloudfront.net', '.googleapis.com')):
        secret_keys |= {'signature', 'expires', 'key-pair-id', 'policy'}
    if host in ('cdn.discordapp.com', 'media.discordapp.net'):
        secret_keys |= {'ex', 'is', 'hm'}
    pairs = parse_qsl(parsed.query, keep_blank_values=True)
    kept = [(key, value) for key, value in pairs if key.lower() not in secret_keys]
    authority = parsed.netloc.rsplit('@', 1)[-1]
    if len(kept) == len(pairs) and authority == parsed.netloc:
        return url
    query = parsed.query if len(kept) == len(pairs) else urlencode(kept)
    return urlunsplit((parsed.scheme, authority, parsed.path, query, parsed.fragment))


def evidence(value):
    """Remove private provider fields without erasing external source identity."""
    if isinstance(value, list):
        return [evidence(v) for v in value]
    if isinstance(value, dict):
        result = {}
        for key, child in value.items():
            if key in ('url_private', 'url_private_download', 'proxy_url', '@microsoft.graph.downloadUrl', 'expiry_time'):
                continue
            if key == 'file' and value.get('type') == 'file' and isinstance(child, dict) and 'url' in child:
                child = {k: v for k, v in child.items() if k != 'url'}
            if key == 'url' and isinstance(child, str):
                child = source_url(child)
            result[key] = evidence(child)
        return result
    return value


def json_artifact(name, value):
    return Artifact(name, 'application/json', json.dumps(evidence(value), sort_keys=True, ensure_ascii=False).encode())


def bounded_rows(body, key, remaining):
    rows = body.get(key, [])
    if not isinstance(rows, list) or len(rows) > remaining:
        raise ProviderError('provider_exceeded_page_bound')
    return rows


def file_objects(value):
    if isinstance(value, dict):
        kind = value.get('type')
        if kind in ('file', 'external') and isinstance(value.get(kind), dict) and value[kind].get('url'):
            yield value
        for child in value.values():
            yield from file_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from file_objects(child)


class CloudDriver:
    def __init__(self, provider: str, http: ProviderHTTP, credentials: dict):
        if provider not in ('google-drive', 'gmail', 'slack', 'notion', 'discord', 'onedrive'):
            raise ProviderError('provider_unsupported')
        self.provider, self.http, self.credentials = provider, http, credentials
        token = credentials.get('access_token')
        if not isinstance(token, str) or not token:
            raise ProviderError('provider_unauthorized')
        self.token = token
        self.headers = {'Authorization': ('Bot ' if provider == 'discord' else 'Bearer ') + token}
        if provider == 'notion':
            self.headers['Notion-Version'] = '2026-03-11'

    async def get(self, url, **params):
        body, _ = await self.http.json('GET', url, headers=self.headers,
                                       params={k: v for k, v in params.items() if v is not None})
        return body

    async def inspect(self):
        url, params = {
            'google-drive': (DRIVE + '/about', {'fields': 'user(permissionId,emailAddress)'}),
            'gmail': (GMAIL + '/profile', {}),
            'slack': (SLACK + '/auth.test', {}),
            'notion': (NOTION + '/users/me', {}),
            'discord': (DISCORD + '/users/@me', {}),
            'onedrive': (GRAPH + '/me/drive', {'$select': 'id,owner'}),
        }[self.provider]
        try:
            body, headers = await self.http.json('GET', url, headers=self.headers, params=params)
            account = {
                'google-drive': lambda: body.get('user', {}).get('permissionId'),
                'gmail': lambda: body.get('emailAddress'),
                'slack': lambda: body.get('team_id'),
                'notion': lambda: body.get('bot', {}).get('workspace_name') or body.get('id'),
                'discord': lambda: body.get('id'), 'onedrive': lambda: body.get('id'),
            }[self.provider]()
            scopes = headers.get('x-oauth-scopes') if self.provider == 'slack' else self.credentials.get('scope')
            return {'health': 'available', 'account_id': account,
                    'granted_scopes': sorted(set(scopes.replace(',', ' ').split())) if isinstance(scopes, str) else None,
                    'scope_support': 'unsupported' if self.provider in ('notion', 'discord') else 'supported',
                    'scope_source': 'provider_header' if self.provider == 'slack' and scopes is not None else
                                    'token_response' if scopes is not None else 'unknown'}
        except ProviderError as exc:
            return {'health': 'unavailable' if exc.code in ('provider_unauthorized', 'provider_forbidden') else 'unknown',
                    'account_id': None, 'granted_scopes': None, 'scope_support': 'unknown', 'error_code': exc.code,
                    'retryable': exc.retryable, 'retry_after': exc.retry_after}

    async def page(self, selection: Selection, cursor: dict, remaining: int) -> Page:
        await self.http.check_cancelled()
        return await getattr(self, '_' + self.provider.replace('-', '_'))(selection, copy.deepcopy(cursor), remaining)

    async def _drive_item(self, item):
        identifier, mime = item['id'], item['mimeType']
        name = item.get('name', identifier)
        params = {'supportsAllDrives': 'true', 'alt': 'media'}
        path = f'{DRIVE}/files/{component(identifier)}'
        if mime in EXPORTS:
            mime, suffix = EXPORTS[mime]
            name += suffix
            path += '/export'
            params = {'mimeType': mime}
        elif mime.startswith('application/vnd.google-apps.'):
            return SourceItem(identifier, name, [json_artifact('metadata.json', item)],
                              evidence(item), ['unsupported_google_native_type'])
        _, _, content = await self.http.request('GET', path, headers=self.headers, params=params)
        return SourceItem(identifier, name, [Artifact(name, mime, content)], evidence(item))

    async def _google_drive(self, s, c, remaining):
        fields = 'id,name,mimeType,modifiedTime,md5Checksum,size,webViewLink'
        if s.file_id:
            item = await self.get(f'{DRIVE}/files/{component(s.file_id)}', fields=fields, supportsAllDrives='true')
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                raise ProviderError('selection_requires_folder_id')
            return Page([await self._drive_item(item)], {}, True, 1)
        queue = c.get('queue', [s.folder_id])
        seen = c.get('seen', [])
        folder = queue[0]
        body = await self.get(DRIVE + '/files', q=f"'{folder}' in parents and trashed = false",
                              fields=f'nextPageToken,incompleteSearch,files({fields})', pageSize=min(100, remaining),
                              pageToken=c.get('page'), supportsAllDrives='true', includeItemsFromAllDrives='true')
        if body.get('incompleteSearch'):
            raise ProviderError('provider_incomplete_search')
        items = []
        for item in bounded_rows(body, 'files', min(100, remaining)):
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                if s.recursive and item['id'] not in seen and item['id'] not in queue:
                    queue.append(item['id'])
            else:
                items.append(await self._drive_item(item))
        token = body.get('nextPageToken')
        if not token:
            seen.append(queue.pop(0))
        return Page(items, {'queue': queue, 'seen': seen, 'page': token}, not queue, len(body.get('files', [])))

    async def _gmail(self, s, c, remaining):
        body = await self.get(GMAIL + '/messages', q=s.query or '', maxResults=min(100, remaining), pageToken=c.get('page'))
        items = []
        for row in bounded_rows(body, 'messages', min(100, remaining)):
            identifier = row['id']
            raw = await self.get(f'{GMAIL}/messages/{component(identifier)}', format='raw')
            try:
                encoded = raw['raw']
                content = base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4))
            except (KeyError, ValueError, TypeError):
                raise ProviderError('provider_invalid_message') from None
            parsed = email.message_from_bytes(content)
            artifacts = [Artifact(identifier + '.eml', 'message/rfc822', content)]
            if s.attachments:
                for i, part in enumerate(parsed.walk()):
                    if part.get_filename() and part.get_payload(decode=True) is not None:
                        artifacts.append(Artifact(f'{i}-{part.get_filename()}', part.get_content_type(), part.get_payload(decode=True)))
                        if len(artifacts) > 100:
                            raise ProviderError('attachment_count_limit')
            meta = {k: raw[k] for k in ('id', 'threadId', 'labelIds', 'internalDate', 'snippet') if k in raw}
            meta['headers'] = {name: str(parsed.get(name, '')) for name in ('From', 'To', 'Cc', 'Subject', 'Date', 'Message-ID')}
            items.append(SourceItem(identifier, str(parsed.get('Subject', identifier)), artifacts, meta))
        token = body.get('nextPageToken')
        return Page(items, {'page': token}, not token, len(items))

    async def _slack(self, s, c, remaining):
        body = await self.get(SLACK + '/conversations.history', channel=s.channel_id, oldest=s.oldest,
                              latest=s.latest, limit=min(15, remaining), cursor=c.get('page'))
        items = []
        for message in bounded_rows(body, 'messages', min(15, remaining)):
            identifier = f'{s.channel_id}:{message["ts"]}'
            artifacts = [json_artifact('message.json', message)]
            limitations = ['thread_replies_not_collected'] if message.get('reply_count') else []
            if s.attachments:
                if len(message.get('files', [])) > 99:
                    raise ProviderError('attachment_count_limit')
                for item in message.get('files', []):
                    detail = (await self.get(SLACK + '/files.info', file=item['id']))['file']
                    url = detail.get('url_private_download') or detail.get('url_private')
                    if not url:
                        limitations.append('file_download_unavailable')
                        continue
                    content, mime = await self.http.download(url, provider='slack', token=self.token)
                    artifacts.append(Artifact(f'{item["id"]}-{detail.get("name", "file")}', mime, content))
            items.append(SourceItem(identifier, identifier, artifacts, {'channel_id': s.channel_id, 'message_ts': message['ts']}, limitations))
        token = body.get('response_metadata', {}).get('next_cursor')
        if body.get('has_more') and not token:
            raise ProviderError('provider_missing_cursor')
        return Page(items, {'page': token}, not token, len(items))

    async def _discord(self, s, c, remaining):
        direction = 'after' if s.after else 'before'
        limit = min(100, remaining)
        body = await self.get(f'{DISCORD}/channels/{component(s.channel_id)}/messages',
                              **{'limit': limit, direction: c.get('page') or s.after or s.before})
        if not isinstance(body, list) or len(body) > limit:
            raise ProviderError('provider_invalid_messages')
        items = []
        for message in body:
            identifier = f'{s.channel_id}:{message["id"]}'
            artifacts = [json_artifact('message.json', message)]
            if s.attachments:
                if len(message.get('attachments', [])) > 99:
                    raise ProviderError('attachment_count_limit')
                for item in message.get('attachments', []):
                    content, mime = await self.http.download(item['url'], provider='discord')
                    artifacts.append(Artifact(f'{item["id"]}-{item.get("filename", "file")}', mime, content))
            items.append(SourceItem(identifier, identifier, artifacts, {'channel_id': s.channel_id, 'message_id': message['id']},
                                    ['message_content_may_require_privileged_intent']))
        token = (str(max(int(m['id']) for m in body)) if s.after else str(min(int(m['id']) for m in body))) if body else None
        return Page(items, {'page': token}, len(body) < limit, len(items))

    async def _notion_item(self, item, s, kind):
        identifier = item['id']
        artifacts = [json_artifact(kind + '.json', item)]
        limitations = []
        if s.attachments:
            files = list(file_objects(item))
            if len(files) > 99:
                raise ProviderError('attachment_count_limit')
            for i, obj in enumerate(files):
                url = obj[obj['type']]['url']
                try:
                    content, mime = await self.http.download(
                        url, provider='notion-external' if obj['type'] == 'external' else 'notion')
                except ProviderError as exc:
                    if obj['type'] == 'external' or exc.code != 'unsupported_attachment_host':
                        raise
                    limitations.append(exc.code)
                    continue
                artifacts.append(Artifact(f'{i}-{urlsplit(url).path.rsplit("/", 1)[-1] or "file"}', mime, content))
        return SourceItem(identifier, identifier, artifacts, {'page_id': s.page_id, 'kind': kind,
                          'external_sources': [source_url(obj['external']['url'])
                                               for obj in file_objects(item) if obj['type'] == 'external']}, limitations)

    async def _notion(self, s, c, remaining):
        if not c:
            page = await self.get(f'{NOTION}/pages/{component(s.page_id)}')
            return Page([await self._notion_item(page, s, 'page')], {'queue': [s.page_id], 'seen': [], 'page': None}, False, 1)
        queue, seen = c['queue'], c.get('seen', [])
        body = await self.get(f'{NOTION}/blocks/{component(queue[0])}/children',
                              page_size=min(100, remaining), start_cursor=c.get('page'))
        items = []
        for block in bounded_rows(body, 'results', min(100, remaining)):
            fresh = await self.get(f'{NOTION}/blocks/{component(block["id"])}') if s.attachments else block
            items.append(await self._notion_item(fresh, s, 'block'))
            if block.get('has_children') and block['id'] not in seen and block['id'] not in queue:
                queue.append(block['id'])
        token = body.get('next_cursor')
        if body.get('has_more') and not token:
            raise ProviderError('provider_missing_cursor')
        if not token:
            seen.append(queue.pop(0))
        return Page(items, {'queue': queue, 'seen': seen, 'page': token}, not queue, len(items))

    async def _onedrive_item(self, item, base):
        identifier = item['id']
        if 'remoteItem' in item:
            return SourceItem(identifier, item.get('name', identifier), [json_artifact('metadata.json', item)],
                              evidence(item), ['remote_item_shortcut_unsupported'])
        status, headers, content = await self.http.request('GET', f'{base}/items/{component(identifier)}/content',
                                                         headers=self.headers, allow_redirect=True)
        mime = item.get('file', {}).get('mimeType', 'application/octet-stream')
        if status in (301, 302, 303, 307, 308):
            content, mime = await self.http.download(headers.get('location', ''), provider='onedrive')
        return SourceItem(identifier, item.get('name', identifier), [Artifact(item.get('name', identifier), mime, content)], evidence(item))

    async def _onedrive(self, s, c, remaining):
        base = f'{GRAPH}/drives/{component(s.drive_id)}' if s.drive_id else GRAPH + '/me/drive'
        if not c:
            path = '/items/' + component(s.item_id) if s.item_id else '/root:/' + '/'.join(component(p) for p in s.path.split('/'))
            initial = await self.get(base + path)
            if 'folder' not in initial:
                return Page([await self._onedrive_item(initial, base)], {}, True, 1)
            c = {'queue': [initial['id']], 'seen': [], 'page': None}
        queue, seen = c['queue'], c.get('seen', [])
        url = f'{base}/items/{component(queue[0])}/children'
        params = {'$top': min(100, remaining)}
        if c.get('page'):
            # Graph nextLink is provider data, yet must retain the exact selected route.
            parsed, expected = urlsplit(c['page']), urlsplit(url)
            if (parsed.scheme, parsed.netloc, parsed.path) != (expected.scheme, expected.netloc, expected.path):
                raise ProviderError('unsafe_provider_cursor')
            query = parse_qs(parsed.query)
            if set(query) - {'$skiptoken', '$top', '$skip', '$select'}:
                raise ProviderError('unsupported_provider_cursor')
            params.update({k: v[0] for k, v in query.items() if k != '$top'})
        body = await self.get(url, **params)
        items = []
        for item in bounded_rows(body, 'value', min(100, remaining)):
            if 'folder' in item:
                if s.recursive and item['id'] not in queue and item['id'] not in seen:
                    queue.append(item['id'])
            else:
                items.append(await self._onedrive_item(item, base))
        token = body.get('@odata.nextLink')
        if not token:
            seen.append(queue.pop(0))
        return Page(items, {'queue': queue, 'seen': seen, 'page': token}, not queue, len(body.get('value', [])))
