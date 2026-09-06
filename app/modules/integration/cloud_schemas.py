"""Closed provider selections; cursors are private server state."""

import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProviderKey = Literal['google-drive', 'gmail', 'slack', 'notion', 'discord', 'onedrive']


class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    folder_id: str | None = None
    file_id: str | None = None
    query: str | None = Field(default=None, max_length=2000)
    allow_all: bool = False
    channel_id: str | None = None
    channel_type: Literal['channels', 'groups', 'im', 'mpim'] = 'channels'
    oldest: str | None = None
    latest: str | None = None
    before: str | None = None
    after: str | None = None
    page_id: str | None = None
    item_id: str | None = None
    path: str | None = Field(default=None, max_length=1024)
    drive_id: str | None = None
    include_shared: bool = False
    recursive: bool = False
    attachments: bool = True
    max_items: int = Field(default=100, ge=1, le=1000)
    max_pages: int = Field(default=100, ge=1, le=1000)
    max_bytes: int = Field(default=50_000_000, ge=1, le=500_000_000)

    @model_validator(mode='after')
    def safe_components(self):
        for key in ('folder_id', 'file_id', 'channel_id', 'page_id', 'item_id', 'drive_id'):
            value = getattr(self, key)
            if value is not None and not re.fullmatch(r'[A-Za-z0-9_!-]{1,200}', value):
                raise ValueError(f'invalid {key}')
        for key in ('oldest', 'latest'):
            value = getattr(self, key)
            if value is not None and not re.fullmatch(r'\d{1,20}(\.\d{1,6})?', value):
                raise ValueError(f'invalid {key}')
        for key in ('before', 'after'):
            value = getattr(self, key)
            if value is not None and not re.fullmatch(r'\d{1,30}', value):
                raise ValueError(f'invalid {key}')
        if self.before and self.after:
            raise ValueError('before and after are mutually exclusive')
        if self.oldest and self.latest and float(self.oldest) >= float(self.latest):
            raise ValueError('oldest must precede latest')
        if self.path is not None and any(p in ('', '.', '..') for p in self.path.split('/')):
            raise ValueError('path must contain nonempty relative components')
        return self

    def for_provider(self, provider: str):
        common = {'attachments', 'max_items', 'max_pages', 'max_bytes'}
        allowed = {
            'google-drive': {'folder_id', 'file_id', 'recursive'},
            'gmail': {'query', 'allow_all'},
            'slack': {'channel_id', 'channel_type', 'oldest', 'latest'},
            'notion': {'page_id'},
            'discord': {'channel_id', 'before', 'after'},
            'onedrive': {'item_id', 'path', 'drive_id', 'include_shared', 'recursive'},
        }
        if provider not in allowed or self.model_fields_set - common - allowed[provider]:
            raise ValueError('selection contains fields unsupported by this provider')
        valid = {
            'google-drive': bool(self.folder_id) != bool(self.file_id),
            'gmail': bool(self.query and self.query.strip()) or self.allow_all,
            'slack': bool(self.channel_id), 'discord': bool(self.channel_id),
            'notion': bool(self.page_id),
            'onedrive': (bool(self.item_id) != bool(self.path)) and (not self.drive_id or self.include_shared),
        }
        if not valid[provider]:
            raise ValueError('explicit bounded source selection required')
        return self


def required_scopes(provider: str, selection: Selection) -> list[str]:
    return {
        'google-drive': ['https://www.googleapis.com/auth/drive.readonly'],
        'gmail': ['https://www.googleapis.com/auth/gmail.readonly'],
        'slack': [f'{selection.channel_type}:history'] + (['files:read'] if selection.attachments else []),
        'onedrive': ['Files.Read.All' if selection.include_shared else 'Files.Read'],
        'notion': [], 'discord': [],
    }[provider]


class CollectionCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    connection_id: UUID
    name: str = Field(min_length=1, max_length=160)
    selection: Selection


class OAuthRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    connection_id: UUID
    scopes: list[str] = Field(max_length=10)
