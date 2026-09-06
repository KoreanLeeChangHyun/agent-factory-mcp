"""Durable worker identity and process-lifetime claims; queue fields grant no authority."""

from contextlib import asynccontextmanager
from hashlib import sha256

from sqlalchemy import or_, select, text, update

from app.db.session import get_session_factory
from app.db.tenant import TenantContext, apply_tenant_context
from app.modules.auth.authorization import AuthorizationRepository, AuthorizationScope, AuthorizationService
from app.modules.auth.service import Principal
from app.modules.identity.models import User, UserStatus
from app.modules.integration.cloud_models import CloudCollectionRun
from app.modules.schedule.models import Job, JobStatus
from app.worker.handlers import PermanentJobError
from uuid import UUID

SYSTEM_ID = UUID("00000000-0000-4000-8000-000000000000")


async def control_scope(session):
    # Internal durable-queue lookup/finalization only. Never passed to a handler.
    await apply_tenant_context(session, TenantContext(SYSTEM_ID, SYSTEM_ID, None, True))


@asynccontextmanager
async def job_guard(engine, job_id):
    key = int.from_bytes(sha256(f'worker-job:{job_id}'.encode()).digest()[:8], 'big', signed=True)
    async with engine.connect() as connection:
        async with connection.begin():
            yield bool(await connection.scalar(text('SELECT pg_try_advisory_xact_lock(:key)'), {'key': key}))


async def authorize_job(session, job):
    await control_scope(session)
    user = await session.scalar(select(User).where(User.id == job.requested_by_user_id).execution_options(populate_existing=True))
    if user is None or user.status != UserStatus.ACTIVE or user.deleted_at is not None:
        raise PermanentJobError('job_requester_unavailable')
    principal = Principal(user.id, user.email, user.display_name, user.is_platform_admin)
    authorization = AuthorizationService(AuthorizationRepository(session))
    scope = AuthorizationScope(job.organization_id, job.workspace_id)
    if job.task_type not in {'integration.sync', 'agent.run'} and job.schedule_id:
        context = await authorization.authorize_any(
            principal, scope, {'schedule.create', 'schedule.update', 'schedule.toggle'})
    else:
        permission = ('integration.use' if job.task_type == 'integration.sync' else
                      'agent.execute' if job.task_type == 'agent.run' else 'job.create')
        context = await authorization.authorize(principal, scope, permission)
    if job.task_type == 'integration.sync' and 'document.import' not in context.permissions:
        raise PermanentJobError('document_permission_required')
    return context


async def cancellation_probe(job_id, organization_id, workspace_id, requester_id):
    async with get_session_factory()() as session:
        await control_scope(session)
        job = await session.scalar(select(Job).where(Job.id == job_id))
        if (job is None or job.organization_id != organization_id or job.workspace_id != workspace_id
                or job.requested_by_user_id != requester_id or job.status != JobStatus.RUNNING):
            return True
        # Recheck current authority before provider I/O and source persistence.
        await authorize_job(session, job)
        return False


async def reconcile_collection(session, job):
    if job.task_type != 'integration.sync' or job.status not in {JobStatus.CANCELLED, JobStatus.FAILED, JobStatus.DEAD}:
        return
    payload = job.payload
    if not isinstance(payload, dict) or set(payload) != {'collection_run_id'}:
        return
    try:
        run_id = UUID(str(payload['collection_run_id']))
    except (ValueError, TypeError):
        return
    if job.idempotency_key != f'collection:{run_id}':
        return
    await session.execute(update(CloudCollectionRun).where(
        CloudCollectionRun.id == run_id, CloudCollectionRun.workspace_id == job.workspace_id,
        CloudCollectionRun.requested_by_user_id == job.requested_by_user_id,
        or_(CloudCollectionRun.job_id == job.id, CloudCollectionRun.job_id.is_(None)),
        CloudCollectionRun.status.not_in(['succeeded', 'bounded', 'failed', 'cancelled']),
    ).values(job_id=job.id, status='cancelled' if job.status == JobStatus.CANCELLED else 'failed',
             error_code=job.error_code, finished_at=job.finished_at))
