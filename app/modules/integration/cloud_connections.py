"""Encrypted cloud credential lifecycle with explicit scope observations."""

import base64
import time
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID

from sqlalchemy import select

from app.modules.auth.authorization import require_context
from app.modules.auth.crypto import new_opaque_token, token_digest
from app.modules.integration.cloud_http import ProviderError
from app.modules.integration.cloud_oauth import (
    OAUTH_SCOPES,
    authorization_url,
    scope_observation,
    token_request,
)
from app.modules.integration.cloud_providers import CloudDriver
from app.modules.integration.models import ConnectionStatus, IntegrationOAuthState

ALIASES = {'google-mail': 'gmail', 'google_drive': 'google-drive'}


class CloudConnections:
    def __init__(self, repository, cipher, settings, http, oauth):
        self.repository, self.cipher, self.settings, self.http, self.oauth = repository, cipher, settings, http, oauth

    async def resolve(self, connection_id):
        connection = await self.repository.connection(connection_id)
        provider = await self.repository.get_provider(connection.provider_id)
        if provider is None:
            raise ProviderError('provider_unavailable')
        key = ALIASES.get(provider.key, provider.key)
        if key not in (*OAUTH_SCOPES, 'discord'):
            raise ProviderError('provider_unsupported')
        return connection, key

    def credentials(self, connection):
        if not connection.encrypted_credentials or connection.status == ConnectionStatus.DISCONNECTED:
            raise ProviderError('provider_unauthorized')
        if connection.encryption_key_version != self.cipher.key_version:
            raise ProviderError('credential_key_version_unavailable')
        return self.cipher.decrypt_json(connection.encrypted_credentials)

    async def store(self, connection, credentials):
        connection.encrypted_credentials = self.cipher.encrypt(credentials)
        connection.encryption_key_version = self.cipher.key_version
        await self.repository.save(connection)

    async def refresh(self, connection, provider, *, force=False):
        credentials = self.credentials(connection)
        if not force and (not credentials.get('expires_at') or float(credentials['expires_at']) > time.time() + 60):
            return credentials
        if provider not in self.oauth or not credentials.get('refresh_token'):
            raise ProviderError('reauthorization_required')
        refreshed = await token_request(self.http, provider, self.oauth[provider], refresh_token=credentials['refresh_token'])
        if 'scope' not in refreshed and 'scope' in credentials:
            refreshed['scope'] = credentials['scope']
        # Persist rotated refresh tokens even if the provider unexpectedly changes scopes.
        await self.store(connection, refreshed)
        state = await self.repository.state(connection.id)
        state.granted_scopes = scope_observation(refreshed)
        await self.repository.save(state)
        if state.granted_scopes is not None and set(state.granted_scopes) - set(state.requested_scopes):
            connection.status = ConnectionStatus.PENDING
            await self.repository.save(connection)
            raise ProviderError('granted_scope_exceeds_approval')
        return refreshed

    async def inspect(self, connection_id, *, live=False):
        require_context(self.repository.context, "integration.read")
        connection, provider = await self.resolve(connection_id)
        async with self.repository.guard(connection_id):
            connection, provider = await self.resolve(connection_id)
            state = await self.repository.state(connection_id)
            if live:
                try:
                    credentials = await self.refresh(connection, provider)
                    observation = await CloudDriver(provider, self.http, credentials).inspect()
                except ProviderError as exc:
                    observation = {'health': 'unknown', 'scope_support': 'unknown', 'granted_scopes': None, 'error_code': exc.code,
                                   'retryable': exc.retryable, 'retry_after': exc.retry_after}
                state.inspection = observation
                state.inspected_at = datetime.now(UTC)
                if observation.get('granted_scopes') is not None:
                    state.granted_scopes = observation['granted_scopes']
                if observation.get('account_id'):
                    connection.external_account_id = str(observation['account_id'])
                await self.repository.save(state)
            return self.project(connection, provider, state)

    async def browse_drive(self, connection_id, parent_id='root', page_token=None):
        require_context(self.repository.context, "integration.read")
        connection, provider = await self.resolve(connection_id)
        if provider != 'google-drive':
            raise ProviderError('provider_unsupported')
        if connection.status != ConnectionStatus.ACTIVE:
            raise ProviderError('connection_not_active')
        credentials = await self.refresh(connection, provider)
        return await CloudDriver(provider, self.http, credentials).drive_folders(parent_id, page_token)

    @staticmethod
    def project(connection, provider, state):
        extra = (sorted(set(state.granted_scopes) - set(state.requested_scopes))
                 if state.granted_scopes is not None else None)
        return {'connection_id': str(connection.id), 'provider': provider, 'name': connection.name,
                'status': connection.status.value, 'account_id': connection.external_account_id,
                'credential_reference': f'integration:{connection.id}' if connection.encrypted_credentials else None,
                'requested_scopes': state.requested_scopes, 'granted_scopes': state.granted_scopes,
                'excess_scopes': extra, 'inspection': state.inspection or {'health': 'unknown', 'scope_support': 'unknown'},
                'inspected_at': state.inspected_at.isoformat() if state.inspected_at else None,
                'inspection_stale': (datetime.now(UTC) - state.inspected_at).total_seconds() > 300
                                    if state.inspected_at else None}

    async def set_token(self, connection_id, token, approved_scopes):
        require_context(self.repository.context, "integration.update")
        connection, provider = await self.resolve(connection_id)
        if provider not in ('slack', 'notion', 'discord'):
            raise ProviderError('api_token_unsupported')
        if not isinstance(token, str) or not 1 <= len(token) <= 10000 or any(c.isspace() for c in token):
            raise ProviderError('invalid_api_token')
        if set(approved_scopes) - OAUTH_SCOPES.get(provider, set()):
            raise ProviderError('unsupported_scope')
        async with self.repository.guard(connection_id):
            connection, provider = await self.resolve(connection_id)
            # Caller declarations are approval bounds, never observed grants.
            state = await self.repository.state(connection_id)
            state.requested_scopes, state.granted_scopes = sorted(set(approved_scopes)), None
            state.inspection, state.inspected_at = {}, None
            connection.status = ConnectionStatus.ACTIVE
            connection.external_account_id = None
            await self.store(connection, {'access_token': token})
        return {'connection_id': str(connection_id), 'health': 'unknown', 'granted_scopes': None}

    async def begin(self, connection_id, scopes):
        require_context(self.repository.context, "integration.update")
        connection, provider = await self.resolve(connection_id)
        config = self.oauth.get(provider)
        if config is None:
            raise ProviderError('oauth_not_configured')
        if len(scopes) > 10 or set(scopes) - OAUTH_SCOPES[provider]:
            raise ProviderError('unsupported_scope')
        if provider in ('google-drive', 'gmail') and set(scopes) != OAUTH_SCOPES[provider]:
            raise ProviderError('required_scope_missing')
        if provider == 'onedrive' and not ({'Files.Read', 'Files.Read.All'} & set(scopes)):
            raise ProviderError('required_scope_missing')
        state, verifier = new_opaque_token(), new_opaque_token()
        challenge = base64.urlsafe_b64encode(sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        url = authorization_url(provider, config, scopes, state, challenge)
        context = self.repository.context
        record = IntegrationOAuthState(
            workspace_id=self.repository.workspace_id, provider_id=connection.provider_id,
            user_id=context.principal.user_id,
            state_digest=token_digest(state, self.settings.auth_token_secret.get_secret_value()),
            encrypted_pkce_verifier=self.cipher.encrypt({'verifier': verifier, 'connection_id': str(connection_id),
                                                       'scopes': sorted(set(scopes)), 'redirect_uri': config.redirect_uri}),
            expires_at=datetime.now(UTC) + timedelta(minutes=10))
        await self.repository.save(record)
        return {'authorization_url': url, 'expires_at': record.expires_at.isoformat(), 'requested_scopes': scopes}

    async def complete(self, state, code):
        require_context(self.repository.context, "integration.update")
        if not 1 <= len(state) <= 512 or not 1 <= len(code) <= 10000:
            raise ProviderError('invalid_oauth_callback')
        await self.repository.scope()
        record = await self.repository.session.scalar(select(IntegrationOAuthState).where(
            IntegrationOAuthState.workspace_id == self.repository.workspace_id,
            IntegrationOAuthState.user_id == self.repository.context.principal.user_id,
            IntegrationOAuthState.state_digest == token_digest(state, self.settings.auth_token_secret.get_secret_value()),
            IntegrationOAuthState.consumed_at.is_(None), IntegrationOAuthState.expires_at > datetime.now(UTC)).with_for_update())
        if record is None:
            raise ProviderError('invalid_oauth_state')
        data = self.cipher.decrypt_json(record.encrypted_pkce_verifier)
        connection, provider = await self.resolve(UUID(data['connection_id']))
        config = self.oauth.get(provider)
        if config is None or config.redirect_uri != data['redirect_uri'] or record.provider_id != connection.provider_id:
            raise ProviderError('oauth_configuration_changed')
        async with self.repository.guard(connection.id):
            connection, provider = await self.resolve(connection.id)
            record.consumed_at = datetime.now(UTC)
            await self.repository.save(record)
            credentials = await token_request(self.http, provider, config, code=code, verifier=data['verifier'])
            state_record = await self.repository.state(connection.id)
            state_record.requested_scopes = data['scopes']
            state_record.granted_scopes = scope_observation(credentials)
            state_record.inspection, state_record.inspected_at = {}, None
            excess = set(state_record.granted_scopes or []) - set(data['scopes'])
            connection.status = ConnectionStatus.PENDING if excess else ConnectionStatus.ACTIVE
            connection.external_account_id = None
            await self.store(connection, credentials)
            return self.project(connection, provider, state_record)
