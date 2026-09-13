# Database policy

PostgreSQL is the only authoritative relational database. All identifiers are
application-generated UUIDs, timestamps are stored with time zone semantics,
and mutable aggregate roots carry a revision for optimistic concurrency.

Tenant-owned tables must contain an `organization_id` or `workspace_id` foreign
key and enable PostgreSQL row-level security. Application authorization remains
mandatory: RLS is defense in depth, not the primary permission system.

Tests marked `integration` use a dedicated PostgreSQL database and may run only
when `AGENT_FACTORY_TEST_DATABASE_URL` is explicitly supplied. Unit tests must
not silently connect to a developer or production database.
