"""Confidential web OAuth clients. Configuration is server-owned, never tool input."""

import base64
import os
import re
import time
from dataclasses import dataclass, field
from urllib.parse import urlencode, urlsplit

from app.modules.integration.cloud_http import ProviderError, ProviderHTTP

OAUTH_SCOPES = {
    'google-drive': {'https://www.googleapis.com/auth/drive.readonly'},
    'gmail': {'https://www.googleapis.com/auth/gmail.readonly'},
    'onedrive': {'Files.Read', 'Files.Read.All', 'offline_access'},
    'slack': {'channels:history', 'groups:history', 'im:history', 'mpim:history', 'files:read'},
    'notion': set(),
}


@dataclass(frozen=True)
class OAuthConfig:
    client_id: str
    client_secret: str = field(repr=False)
    redirect_uri: str
    tenant: str = 'common'

    def __post_init__(self):
        parsed = urlsplit(self.redirect_uri)
        if (parsed.scheme != 'https' or not parsed.hostname or parsed.hostname == 'localhost'
                or parsed.username or parsed.password or parsed.fragment or parsed.query):
            raise ValueError('OAuth requires a configured HTTPS cloud callback')
        if not re.fullmatch(r'[A-Za-z0-9.-]+', self.tenant):
            raise ValueError('invalid Microsoft tenant')


def environment_oauth(settings=None) -> dict[str, OAuthConfig]:
    if settings is None:
        from app.core.config import settings
    configs = {}
    for provider in OAUTH_SCOPES:
        prefix = provider.replace('-', '_') + '_oauth_'
        client_id = getattr(settings, prefix + 'client_id')
        secret = getattr(settings, prefix + 'client_secret')
        redirect = getattr(settings, prefix + 'redirect_uri')
        if any((client_id, secret, redirect)):
            if not all((client_id, secret, redirect)):
                raise ValueError('incomplete provider OAuth configuration')
            expected = settings.public_base_url.rstrip('/') + '/api/integrations/oauth/' + provider + '/callback'
            if redirect != expected:
                raise ValueError('OAuth redirect must be the configured first-party callback')
            configs[provider] = OAuthConfig(client_id, secret.get_secret_value(), redirect,
                tenant=getattr(settings, 'onedrive_oauth_tenant', 'common'))
    return configs


def endpoints(provider, config):
    if provider in ('google-drive', 'gmail'):
        return 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token'
    if provider == 'onedrive':
        base = f'https://login.microsoftonline.com/{config.tenant}/oauth2/v2.0'
        return base + '/authorize', base + '/token'
    if provider == 'slack':
        return 'https://slack.com/oauth/v2/authorize', 'https://slack.com/api/oauth.v2.access'
    if provider == 'notion':
        return 'https://api.notion.com/v1/oauth/authorize', 'https://api.notion.com/v1/oauth/token'
    raise ProviderError('oauth_unsupported')


def authorization_url(provider, config, scopes, state, challenge):
    if provider not in OAUTH_SCOPES or set(scopes) - OAUTH_SCOPES[provider]:
        raise ProviderError('unsupported_scope')
    params = dict(client_id=config.client_id, redirect_uri=config.redirect_uri, response_type='code', state=state)
    if provider == 'notion':
        params['owner'] = 'user'
    else:
        params['scope'] = (',' if provider == 'slack' else ' ').join(scopes)
    if provider in ('google-drive', 'gmail', 'onedrive'):
        params.update(code_challenge=challenge, code_challenge_method='S256')
    if provider in ('google-drive', 'gmail'):
        params.update(access_type='offline', prompt='consent', include_granted_scopes='false')
    return endpoints(provider, config)[0] + '?' + urlencode(params)


async def token_request(http: ProviderHTTP, provider, config, *, code=None, verifier=None, refresh_token=None):
    data = {'grant_type': 'refresh_token' if refresh_token else 'authorization_code'}
    if refresh_token:
        data['refresh_token'] = refresh_token
    else:
        data.update(code=code, redirect_uri=config.redirect_uri)
        if provider in ('google-drive', 'gmail', 'onedrive'):
            data['code_verifier'] = verifier
    url = endpoints(provider, config)[1]
    if provider == 'notion':
        basic = base64.b64encode(f'{config.client_id}:{config.client_secret}'.encode()).decode()
        result, _ = await http.json('POST', url, json=data, headers={'Authorization': f'Basic {basic}'})
    else:
        data.update(client_id=config.client_id, client_secret=config.client_secret)
        result, _ = await http.json('POST', url, data=data)
    if not isinstance(result, dict) or not isinstance(result.get('access_token'), str):
        raise ProviderError('oauth_exchange_failed')
    credentials = {key: result[key] for key in ('access_token', 'refresh_token', 'scope', 'token_type') if key in result}
    if result.get('expires_in') is not None:
        try:
            credentials['expires_at'] = time.time() + int(result['expires_in'])
        except (ValueError, TypeError):
            raise ProviderError('oauth_invalid_expiry') from None
    if refresh_token and not credentials.get('refresh_token'):
        credentials['refresh_token'] = refresh_token
    return credentials


def scope_observation(credentials):
    scope = credentials.get('scope')
    if isinstance(scope, str):
        return sorted(set(scope.replace(',', ' ').split()))
    return None
