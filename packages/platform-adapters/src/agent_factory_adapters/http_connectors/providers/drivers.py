from __future__ import annotations

import base64
import copy
import email
import json
from collections.abc import Awaitable, Callable, Mapping
from typing import cast
from urllib.parse import parse_qs, parse_qsl, quote, urlencode, urlsplit, urlunsplit

from agent_factory_adapters.http_connectors.providers.client import SafeProviderHttpClient
from agent_factory_core.connections.providers.collection_domain import (
    CollectionSelection,
    DriveSource,
    DriveSourcePage,
    SourceArtifact,
    SourceItem,
    SourcePage,
)
from agent_factory_core.shared.errors import ApplicationError

DRIVE = "https://www.googleapis.com/drive/v3"
GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"
SLACK = "https://slack.com/api"
NOTION = "https://api.notion.com/v1"
DISCORD = "https://discord.com/api/v10"
GRAPH = "https://graph.microsoft.com/v1.0"
EXPORTS = {
    "application/vnd.google-apps.document": ("application/pdf", ".pdf"),
    "application/vnd.google-apps.presentation": ("application/pdf", ".pdf"),
    "application/vnd.google-apps.drawing": ("application/pdf", ".pdf"),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
    ),
}
Cancellation = Callable[[], Awaitable[bool]]


class ProviderDriverError(ApplicationError):
    def __init__(self, code: str, *, retryable: bool = False, retry_after: int = 0) -> None:
        super().__init__(code, "Provider collection request failed", 502)
        self.retryable = retryable
        self.retry_after = retry_after


def sanitized_source_url(value: str) -> str:
    parsed = urlsplit(value)
    secrets = {
        "access_token",
        "refresh_token",
        "bearer_token",
        "x-amz-signature",
        "x-amz-credential",
        "x-amz-security-token",
        "x-amz-algorithm",
        "x-amz-date",
        "x-amz-expires",
        "x-amz-signedheaders",
        "x-goog-signature",
        "x-goog-credential",
        "x-goog-algorithm",
        "x-goog-date",
        "x-goog-expires",
        "x-goog-signedheaders",
    }
    if (parsed.hostname or "").endswith((".amazonaws.com", ".cloudfront.net", ".googleapis.com")):
        secrets |= {"signature", "expires", "key-pair-id", "policy"}
    if parsed.hostname in {"cdn.discordapp.com", "media.discordapp.net"}:
        secrets |= {"ex", "is", "hm"}
    query = urlencode(
        [
            (key, item)
            for key, item in parse_qsl(parsed.query, keep_blank_values=True)
            if key.lower() not in secrets
        ]
    )
    return urlunsplit(
        (parsed.scheme, parsed.netloc.rsplit("@", 1)[-1], parsed.path, query, parsed.fragment)
    )


def sanitized_evidence(value: object) -> object:
    if isinstance(value, list):
        return [sanitized_evidence(item) for item in value]
    if isinstance(value, dict):
        return {
            key: sanitized_evidence(
                sanitized_source_url(child) if key == "url" and isinstance(child, str) else child
            )
            for key, child in value.items()
            if key
            not in {
                "url_private",
                "url_private_download",
                "proxy_url",
                "@microsoft.graph.downloadUrl",
                "expiry_time",
            }
        }
    return value


class ProviderCollectionDriver:
    def __init__(
        self,
        provider: str,
        client: SafeProviderHttpClient,
        credentials: Mapping[str, object],
        *,
        cancelled: Cancellation | None = None,
    ) -> None:
        if provider not in {"google-drive", "gmail", "slack", "notion", "discord", "onedrive"}:
            raise ProviderDriverError("provider_unsupported")
        token = credentials.get("access_token")
        if not isinstance(token, str) or not token:
            raise ProviderDriverError("provider_unauthorized")
        self.provider = provider
        self.client = client
        self.credentials = credentials
        self.cancelled = cancelled
        self.observed_scopes: set[str] | None = None
        self.headers = {"Authorization": ("Bot " if provider == "discord" else "Bearer ") + token}
        if provider == "notion":
            self.headers["Notion-Version"] = "2026-03-11"

    async def _check_cancelled(self) -> None:
        if self.cancelled and await self.cancelled():
            raise ProviderDriverError("collection_cancelled")

    async def _request(
        self, url: str, params: Mapping[str, object] | None = None, *, authorized: bool = True
    ) -> tuple[object, Mapping[str, str], int]:
        await self._check_cancelled()
        query = urlencode(
            [(key, str(value)) for key, value in (params or {}).items() if value is not None]
        )
        target = url + (("&" if "?" in url else "?") + query if query else "")
        response = await self.client.request(
            "GET", target, headers=self.headers if authorized else {}
        )
        if response.status_code == 429 or response.status_code >= 500:
            delay = (
                int(response.headers.get("retry-after", "0"))
                if response.headers.get("retry-after", "").isdigit()
                else 0
            )
            raise ProviderDriverError("provider_retryable", retryable=True, retry_after=delay)
        if response.status_code in {401, 403, 404}:
            raise ProviderDriverError(
                {
                    401: "provider_unauthorized",
                    403: "provider_forbidden",
                    404: "provider_not_found",
                }[response.status_code]
            )
        if response.status_code >= 400:
            raise ProviderDriverError("provider_rejected")
        try:
            value = json.loads(response.body)
            if isinstance(value, dict) and value.get("ok") is False:
                code = str(value.get("error", "provider_rejected"))
                if code in {"ratelimited", "service_unavailable", "internal_error"}:
                    raise ProviderDriverError("provider_retryable", retryable=True, retry_after=0)
                raise ProviderDriverError(
                    "provider_unauthorized"
                    if code in {"invalid_auth", "not_authed", "token_revoked"}
                    else "provider_rejected"
                )
            return value, response.headers, len(response.body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ProviderDriverError("provider_invalid_json") from error

    async def _download(
        self, url: str, *, authorized: bool = False
    ) -> tuple[bytes, Mapping[str, str]]:
        await self._check_cancelled()
        redirect_hosts = {
            "google-drive": ("googleapis.com", "googleusercontent.com"),
            "gmail": ("googleapis.com", "googleusercontent.com"),
            "slack": ("slack.com",),
            "discord": ("discordapp.com", "discordapp.net"),
            "onedrive": ("microsoft.com", "sharepoint.com", "1drv.com", "azureedge.net"),
            "notion": (),
        }[self.provider]
        response = await self.client.request(
            "GET",
            url,
            headers=self.headers if authorized else {},
            redirect_host_suffixes=redirect_hosts,
        )
        if response.status_code == 429 or response.status_code >= 500:
            delay = response.headers.get("retry-after", "")
            raise ProviderDriverError(
                "provider_retryable",
                retryable=True,
                retry_after=int(delay) if delay.isdigit() else 0,
            )
        if response.status_code >= 400:
            raise ProviderDriverError("provider_attachment_unavailable")
        return response.body, response.headers

    async def inspect(self) -> dict[str, object]:
        url, params = {
            "google-drive": (DRIVE + "/about", {"fields": "user(permissionId,emailAddress)"}),
            "gmail": (GMAIL + "/profile", {}),
            "slack": (SLACK + "/auth.test", {}),
            "notion": (NOTION + "/users/me", {}),
            "discord": (DISCORD + "/users/@me", {}),
            "onedrive": (GRAPH + "/me/drive", {"$select": "id,owner"}),
        }[self.provider]
        try:
            body, headers, _ = await self._request(url, params)
            assert isinstance(body, dict)
            account = {
                "google-drive": lambda: body.get("user", {}).get("permissionId"),
                "gmail": lambda: body.get("emailAddress"),
                "slack": lambda: body.get("team_id"),
                "notion": lambda: body.get("id"),
                "discord": lambda: body.get("id"),
                "onedrive": lambda: body.get("id"),
            }[self.provider]()
            scopes = (
                headers.get("x-oauth-scopes")
                if self.provider == "slack"
                else self.credentials.get("scope")
            )
            self.observed_scopes = (
                set(scopes.replace(",", " ").split()) if isinstance(scopes, str) else None
            )
            return {
                "health": "available",
                "account_id": account,
                "granted_scopes": sorted(self.observed_scopes)
                if self.observed_scopes is not None
                else None,
                "scope_support": "unsupported"
                if self.provider in {"notion", "discord"}
                else "supported",
            }
        except ProviderDriverError as error:
            return {
                "health": "unavailable"
                if error.code in {"provider_unauthorized", "provider_forbidden"}
                else "unknown",
                "error_code": error.code,
                "retryable": error.retryable,
                "retry_after": error.retry_after,
            }

    async def page(
        self,
        selection: CollectionSelection,
        cursor: dict[str, object],
        remaining: int,
        *,
        metadata_only: bool,
    ) -> SourcePage:
        await self._check_cancelled()
        self._validate_scopes(selection)
        if metadata_only and self.provider != "google-drive":
            raise ProviderDriverError("reference_mode_unsupported")
        return await getattr(self, "_" + self.provider.replace("-", "_"))(
            selection, copy.deepcopy(cursor), remaining, metadata_only
        )

    async def browse_drive(self, folder_id: str, cursor: str | None, limit: int) -> DriveSourcePage:
        if self.provider != "google-drive" or not 1 <= limit <= 100:
            raise ProviderDriverError("drive_browse_unsupported")
        self._validate_scopes(CollectionSelection({"file_id": folder_id}))
        if not folder_id or not all(
            character.isalnum() or character in "_!-" for character in folder_id
        ):
            raise ProviderDriverError("invalid_drive_browse")
        body, _, _ = await self._request(
            DRIVE + "/files",
            {
                "q": f"'{folder_id}' in parents and trashed = false",
                "pageSize": limit,
                "pageToken": cursor,
                "fields": "nextPageToken,files(id,name,mimeType,parents,modifiedTime)",
            },
        )
        if not isinstance(body, dict):
            raise ProviderDriverError("provider_invalid_json")
        rows = self._rows(body, "files", limit)
        return DriveSourcePage(
            tuple(
                DriveSource(
                    str(row["id"]),
                    str(row.get("name", row["id"])),
                    str(row.get("mimeType", "application/octet-stream")),
                    tuple(str(parent) for parent in cast(list[object], row.get("parents", []))),
                    str(row["modifiedTime"]) if row.get("modifiedTime") else None,
                )
                for row in rows
            ),
            str(body["nextPageToken"]) if body.get("nextPageToken") else None,
        )

    def _validate_scopes(self, selection: CollectionSelection) -> None:
        if self.provider in {"notion", "discord"}:
            return
        if self.observed_scopes is None:
            raise ProviderDriverError("granted_scopes_unknown")
        granted = self.observed_scopes
        required = {
            "google-drive": {"https://www.googleapis.com/auth/drive.readonly"},
            "gmail": {"https://www.googleapis.com/auth/gmail.readonly"},
            "onedrive": {
                "Files.Read.All" if selection.values.get("include_shared") else "Files.Read"
            },
            "notion": set(),
            "discord": set(),
            "slack": {
                {
                    "public": "channels:history",
                    "private": "groups:history",
                    "im": "im:history",
                    "mpim": "mpim:history",
                }.get(str(selection.values.get("channel_type")), "channels:history")
            }
            | ({"files:read"} if selection.attachments else set()),
        }[self.provider]
        if required - granted:
            raise ProviderDriverError("provider_scope_missing")

    @staticmethod
    def _rows(body: object, key: str, limit: int) -> list[dict[str, object]]:
        if (
            not isinstance(body, dict)
            or not isinstance(body.get(key), list)
            or len(body[key]) > limit
        ):
            raise ProviderDriverError("provider_exceeded_page_bound")
        return body[key]

    @staticmethod
    def _json_item(name: str, value: object) -> SourceArtifact:
        return SourceArtifact(
            name,
            "application/json",
            json.dumps(sanitized_evidence(value), sort_keys=True, ensure_ascii=False).encode(),
        )

    async def _google_drive(self, selection, cursor, remaining, metadata_only):
        fields = "id,name,mimeType,createdTime,modifiedTime,md5Checksum,size,fileExtension,webViewLink,parents"
        selected = selection.values
        if selected.get("file_id"):
            item, _, size = await self._request(
                f"{DRIVE}/files/{quote(str(selected['file_id']), safe='')}", {"fields": fields}
            )
            assert isinstance(item, dict)
            source = await self._drive_item(item, metadata_only)
            return SourcePage(
                (source,), {}, True, 1, size + sum(len(a.content) for a in source.artifacts)
            )
        queue = list(cursor.get("queue", [selected.get("folder_id")]))
        seen = list(cursor.get("seen", []))
        body, _, size = await self._request(
            DRIVE + "/files",
            {
                "q": f"'{queue[0]}' in parents and trashed = false",
                "fields": f"nextPageToken,incompleteSearch,files({fields})",
                "pageSize": min(100, remaining),
                "pageToken": cursor.get("page"),
            },
        )
        rows = self._rows(body, "files", min(100, remaining))
        items = []
        for item in rows:
            if item.get("mimeType") == "application/vnd.google-apps.folder":
                if selected.get("recursive") and item["id"] not in queue and item["id"] not in seen:
                    queue.append(item["id"])
            else:
                items.append(await self._drive_item(item, metadata_only))
        token = body.get("nextPageToken")
        if not token:
            seen.append(queue.pop(0))
        return SourcePage(
            tuple(items),
            {"queue": queue, "seen": seen, "page": token},
            not queue,
            len(rows),
            size + sum(len(a.content) for i in items for a in i.artifacts),
        )

    async def _drive_item(self, item, metadata_only):
        identity, mime = str(item["id"]), str(item["mimeType"])
        name = str(item.get("name", identity))
        if metadata_only:
            return SourceItem(identity, name, (), sanitized_evidence(item))
        if mime.startswith("application/vnd.google-apps.") and mime not in EXPORTS:
            return SourceItem(
                identity,
                name,
                (self._json_item("metadata.json", item),),
                sanitized_evidence(item),
                ("unsupported_google_native_type",),
            )
        path = f"{DRIVE}/files/{quote(identity, safe='')}"
        params = {"alt": "media"}
        if mime in EXPORTS:
            mime, suffix = EXPORTS[mime]
            name, path, params = name + suffix, path + "/export", {"mimeType": mime}
        query = urlencode(params)
        content, _ = await self._download(path + "?" + query, authorized=True)
        return SourceItem(
            identity, name, (SourceArtifact(name, mime, content),), sanitized_evidence(item)
        )

    async def _gmail(self, selection, cursor, remaining, metadata_only):
        body, _, size = await self._request(
            GMAIL + "/messages",
            {
                "q": selection.values.get("query", ""),
                "maxResults": min(100, remaining),
                "pageToken": cursor.get("page"),
            },
        )
        items = []
        for row in self._rows(body, "messages", min(100, remaining)):
            raw, _, consumed = await self._request(
                f"{GMAIL}/messages/{quote(str(row['id']), safe='')}", {"format": "raw"}
            )
            size += consumed
            assert isinstance(raw, dict)
            try:
                encoded = str(raw["raw"])
                content = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
            except (KeyError, ValueError) as error:
                raise ProviderDriverError("provider_invalid_message") from error
            message = email.message_from_bytes(content)
            artifacts = [SourceArtifact(str(row["id"]) + ".eml", "message/rfc822", content)]
            if selection.attachments:
                artifacts.extend(
                    SourceArtifact(str(part.get_filename()), part.get_content_type(), payload)
                    for part in message.walk()
                    if part.get_filename()
                    and (payload := part.get_payload(decode=True)) is not None
                )
            if len(artifacts) > 100:
                raise ProviderDriverError("attachment_count_limit")
            items.append(
                SourceItem(
                    str(row["id"]),
                    str(message.get("Subject", row["id"])),
                    tuple(artifacts),
                    sanitized_evidence(raw),
                )
            )
        token = body.get("nextPageToken")
        return SourcePage(
            tuple(items),
            {"page": token},
            not token,
            len(items),
            size + sum(len(a.content) for i in items for a in i.artifacts),
        )

    async def _slack(self, selection, cursor, remaining, metadata_only):
        channel = str(selection.values["channel_id"])
        body, _, size = await self._request(
            SLACK + "/conversations.history",
            {
                "channel": channel,
                "limit": min(15, remaining),
                "cursor": cursor.get("page"),
                "oldest": selection.values.get("oldest"),
                "latest": selection.values.get("latest"),
            },
        )
        items = []
        for message in self._rows(body, "messages", min(15, remaining)):
            artifacts = [self._json_item("message.json", message)]
            limitations = ["thread_replies_not_collected"] if message.get("reply_count") else []
            files = message.get("files", []) if selection.attachments else []
            if not isinstance(files, list) or len(files) > 99:
                raise ProviderDriverError("attachment_count_limit")
            for item in files:
                detail, _, consumed = await self._request(
                    SLACK + "/files.info", {"file": item["id"]}
                )
                size += consumed
                assert isinstance(detail, dict)
                file = detail.get("file", {})
                url = file.get("url_private_download") or file.get("url_private")
                if not isinstance(url, str) or urlsplit(url).hostname != "files.slack.com":
                    limitations.append("file_download_unavailable")
                    continue
                content, headers = await self._download(url, authorized=True)
                artifacts.append(
                    SourceArtifact(
                        str(file.get("name", item["id"])),
                        headers.get("content-type", "application/octet-stream"),
                        content,
                    )
                )
            identity = f"{channel}:{message['ts']}"
            items.append(
                SourceItem(
                    identity,
                    identity,
                    tuple(artifacts),
                    {"channel_id": channel, "message_ts": message["ts"]},
                    tuple(limitations),
                )
            )
        token = body.get("response_metadata", {}).get("next_cursor")
        if body.get("has_more") and not token:
            raise ProviderDriverError("provider_missing_cursor")
        return SourcePage(
            tuple(items),
            {"page": token},
            not token,
            len(items),
            size + sum(len(a.content) for i in items for a in i.artifacts),
        )

    async def _discord(self, selection, cursor, remaining, metadata_only):
        direction = "after" if selection.values.get("after") else "before"
        limit = min(100, remaining)
        body, _, size = await self._request(
            f"{DISCORD}/channels/{quote(str(selection.values['channel_id']), safe='')}/messages",
            {"limit": limit, direction: cursor.get("page") or selection.values.get(direction)},
        )
        if not isinstance(body, list) or len(body) > limit:
            raise ProviderDriverError("provider_invalid_messages")
        items = []
        for row in body:
            artifacts = [self._json_item("message.json", row)]
            attachments = row.get("attachments", []) if selection.attachments else []
            if not isinstance(attachments, list) or len(attachments) > 99:
                raise ProviderDriverError("attachment_count_limit")
            for attachment in attachments:
                url = attachment.get("url")
                host = urlsplit(str(url)).hostname
                if not isinstance(url, str) or host not in {
                    "cdn.discordapp.com",
                    "media.discordapp.net",
                }:
                    raise ProviderDriverError("unsafe_provider_attachment")
                content, headers = await self._download(url)
                artifacts.append(
                    SourceArtifact(
                        str(attachment.get("filename", attachment.get("id", "attachment"))),
                        str(
                            attachment.get(
                                "content_type",
                                headers.get("content-type", "application/octet-stream"),
                            )
                        ),
                        content,
                    )
                )
            items.append(
                SourceItem(
                    f"{selection.values['channel_id']}:{row['id']}",
                    str(row["id"]),
                    tuple(artifacts),
                    sanitized_evidence(row),
                    ("message_content_may_require_privileged_intent",),
                )
            )
        token = (
            (
                str(max(int(row["id"]) for row in body))
                if direction == "after"
                else str(min(int(row["id"]) for row in body))
            )
            if body
            else None
        )
        return SourcePage(
            tuple(items),
            {"page": token},
            len(body) < limit,
            len(items),
            size + sum(len(a.content) for i in items for a in i.artifacts),
        )

    async def _notion(self, selection, cursor, remaining, metadata_only):
        page_id = str(selection.values["page_id"])
        if not cursor:
            body, _, size = await self._request(f"{NOTION}/pages/{quote(page_id, safe='')}")
            assert isinstance(body, dict)
            item = SourceItem(
                str(body["id"]),
                str(body["id"]),
                (self._json_item("page.json", body),),
                {"page_id": page_id, "kind": "page"},
            )
            return SourcePage(
                (item,),
                {"queue": [page_id], "seen": [], "page": None},
                False,
                1,
                size + len(item.artifacts[0].content),
            )
        queue, seen = list(cursor["queue"]), list(cursor.get("seen", []))
        body, _, size = await self._request(
            f"{NOTION}/blocks/{quote(str(queue[0]), safe='')}/children",
            {"page_size": min(100, remaining), "start_cursor": cursor.get("page")},
        )
        rows = self._rows(body, "results", min(100, remaining))
        items = []
        for row in rows:
            artifacts = [self._json_item("block.json", row)]
            if selection.attachments:
                urls = self._notion_file_urls(row)
                if len(urls) > 99:
                    raise ProviderDriverError("attachment_count_limit")
                for index, url in enumerate(urls):
                    content, headers = await self._download(url)
                    filename = urlsplit(url).path.rsplit("/", 1)[-1] or f"file-{index}"
                    artifacts.append(
                        SourceArtifact(
                            filename,
                            headers.get("content-type", "application/octet-stream"),
                            content,
                        )
                    )
            items.append(
                SourceItem(
                    str(row["id"]),
                    str(row["id"]),
                    tuple(artifacts),
                    {"page_id": page_id, "kind": "block"},
                )
            )
        for row in rows:
            if row.get("has_children") and row["id"] not in queue and row["id"] not in seen:
                queue.append(row["id"])
        token = body.get("next_cursor")
        if body.get("has_more") and not token:
            raise ProviderDriverError("provider_missing_cursor")
        if not token:
            seen.append(queue.pop(0))
        return SourcePage(
            tuple(items),
            {"queue": queue, "seen": seen, "page": token},
            not queue,
            len(items),
            size + sum(len(a.content) for i in items for a in i.artifacts),
        )

    @staticmethod
    def _notion_file_urls(value: object) -> list[str]:
        urls: list[str] = []
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "url" and isinstance(child, str):
                    parent_type = value.get("type")
                    if parent_type in {"file", "external"}:
                        urls.append(child)
                else:
                    urls.extend(ProviderCollectionDriver._notion_file_urls(child))
        elif isinstance(value, list):
            for child in value:
                urls.extend(ProviderCollectionDriver._notion_file_urls(child))
        return urls

    async def _onedrive(self, selection, cursor, remaining, metadata_only):
        base = (
            f"{GRAPH}/drives/{quote(str(selection.values['drive_id']), safe='')}"
            if selection.values.get("drive_id")
            else GRAPH + "/me/drive"
        )
        if not cursor:
            selected = (
                f"/items/{quote(str(selection.values['item_id']), safe='')}"
                if selection.values.get("item_id")
                else "/root:/"
                + "/".join(
                    quote(part, safe="") for part in str(selection.values["path"]).split("/")
                )
            )
            initial, _, size = await self._request(base + selected)
            assert isinstance(initial, dict)
            if "folder" not in initial:
                item = await self._onedrive_item(initial, base)
                return SourcePage(
                    (item,), {}, True, 1, size + sum(len(a.content) for a in item.artifacts)
                )
            cursor = {"queue": [initial["id"]], "seen": [], "page": None}
        queue, seen = list(cursor["queue"]), list(cursor.get("seen", []))
        url = f"{base}/items/{quote(str(queue[0]), safe='')}/children"
        params = {"$top": min(100, remaining)}
        if cursor.get("page"):
            parsed, expected = urlsplit(str(cursor["page"])), urlsplit(url)
            if (parsed.scheme, parsed.netloc, parsed.path) != (
                expected.scheme,
                expected.netloc,
                expected.path,
            ):
                raise ProviderDriverError("unsafe_provider_cursor")
            query = parse_qs(parsed.query)
            if set(query) - {"$skiptoken", "$top", "$skip", "$select"}:
                raise ProviderDriverError("unsupported_provider_cursor")
            params.update({key: values[0] for key, values in query.items() if key != "$top"})
        body, _, size = await self._request(url, params)
        rows = self._rows(body, "value", min(100, remaining))
        items = []
        for row in rows:
            if "folder" in row:
                if (
                    selection.values.get("recursive")
                    and row["id"] not in queue
                    and row["id"] not in seen
                ):
                    queue.append(row["id"])
            else:
                items.append(await self._onedrive_item(row, base))
        token = body.get("@odata.nextLink")
        if not token:
            seen.append(queue.pop(0))
        return SourcePage(
            tuple(items),
            {"queue": queue, "seen": seen, "page": token},
            not queue,
            len(rows),
            size + sum(len(a.content) for i in items for a in i.artifacts),
        )

    async def _onedrive_item(self, item, base):
        identity, name = str(item["id"]), str(item.get("name", item["id"]))
        if "remoteItem" in item:
            return SourceItem(
                identity,
                name,
                (self._json_item("metadata.json", item),),
                sanitized_evidence(item),
                ("remote_item_shortcut_unsupported",),
            )
        content, headers = await self._download(
            f"{base}/items/{quote(identity, safe='')}/content", authorized=True
        )
        mime = str(
            item.get("file", {}).get(
                "mimeType", headers.get("content-type", "application/octet-stream")
            )
        )
        return SourceItem(
            identity, name, (SourceArtifact(name, mime, content),), sanitized_evidence(item)
        )
