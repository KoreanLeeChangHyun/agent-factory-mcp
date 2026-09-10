# Scheduler and worker policy

PostgreSQL Job rows are authoritative; Celery and Redis provide delivery. Each
job has a Workspace-scoped idempotency key, bounded task type and queue,
priority, attempt budget, ordered events, and explicit cancellation state.
Workers claim jobs under row lock and tenant context before executing handlers.

Failures retry with bounded exponential backoff. Exhausted jobs enter `dead`
with their error and timestamp retained for operator inspection and manual
retry. Beat scans schedules every minute and retry/outbox records every thirty
seconds. Missing broker publication leaves a queued row with no task ID, which
the outbox scan republishes. Duplicate deliveries are harmless because only one
worker can move a queued/retry row to running.

Schedules accept either a five-field cron expression with an IANA timezone or
an interval of at least sixty seconds. Task types are pinned to named queues so
untrusted payloads cannot select arbitrary Celery tasks. Running cancellation
is cooperative; handlers must check durable cancellation at safe boundaries.
