"""Trusted-context integration.sync handler; never register as payload-only."""

from uuid import UUID

from app.common.errors import ApplicationError
from app.modules.integration.cloud_factory import cloud_services
from app.modules.integration.cloud_http import ProviderError
from app.worker.handlers import PermanentJobError


async def integration_sync(payload, *, session, context, job_id: UUID, cancelled):
    """Worker supplies an independently authorized context and job cancellation probe.

    The payload has exactly one opaque run ID, and confers no workspace/user
    authority. Context must be reauthorized from the claimed Job at execution.
    """
    if not isinstance(payload, dict) or set(payload) != {'collection_run_id'}:
        raise PermanentJobError('invalid_collection_payload')
    try:
        run_id = UUID(str(payload['collection_run_id']))
    except (ValueError, TypeError):
        raise PermanentJobError('invalid_collection_run_id') from None
    try:
        async with cloud_services(session, context) as service:
            return await service.execute(run_id, job_id=job_id, cancelled=cancelled)
    except ProviderError as exc:
        if not exc.retryable:
            raise PermanentJobError(exc.code) from None
        # Preserve only allowlisted code/delay. Shared worker must honor delay.
        raise ProviderError(exc.code, retryable=True, retry_after=exc.retry_after) from None
    except ApplicationError as exc:
        if exc.code == 'integration_busy':
            raise ProviderError('integration_busy', retryable=True, retry_after=5) from None
        raise PermanentJobError('collection_authorization_or_state_error') from None
    except Exception:
        raise ProviderError('collection_persistence_error', retryable=True) from None
