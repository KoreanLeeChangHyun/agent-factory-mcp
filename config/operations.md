# Production operations runbook

## Release and rollback

Build immutable images tagged with the Git SHA, scan them, deploy migrations as
a one-shot release task, then roll API instances start-first and workers after
API readiness succeeds. Migrations must be expand/contract compatible with the
previous release. Roll back the image immediately on elevated errors; never
downgrade a migration until its downgrade was rehearsed against a restored copy.

## Probes and scaling

`/live` checks only the process. `/ready` checks authoritative PostgreSQL and
removes an instance from traffic on failure. The proxy actively probes `/ready`.
Scale stateless API replicas on concurrency/latency and workers per named queue
on queue age, not only CPU. Run exactly one Beat scheduler; database locks and
idempotency remain the final duplicate-execution defense.

## Backup and recovery

Run `deploy/backup.sh` into encrypted, immutable remote storage. Retain daily,
weekly, and monthly generations according to policy. Each quarter, restore both
PostgreSQL and object storage into an isolated account, run migrations and smoke
tests, verify Document checksums, and record achieved RPO/RTO in audit history.

## Alerts and cost

Page on readiness failure, sustained 5xx rate, authentication spikes, audit
write failures, dead jobs, queue age, database saturation, backup failure, and
object-store errors. Ticket on p95 latency, vector-index growth, webhook retry
rate, email delivery, and expiring OAuth credentials. Track cost by Workspace
from Agent token usage, storage bytes, vector chunks, job runtime, and egress.
