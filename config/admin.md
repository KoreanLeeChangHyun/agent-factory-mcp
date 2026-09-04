# Platform administration policy

The admin surface is separate from the tenant Workspace at `/admin/` internally
and `/factory/admin/` publicly. Its data APIs live below `/api/admin` internally
and `/factory/api/admin` publicly. Loading static assets grants no authority;
every admin API independently requires an active platform-administrator
principal and establishes an explicit cross-tenant database context.

The initial control plane exposes aggregate health, users and session
revocation, organizations, Workspaces, ownership grants, durable jobs,
integration health, feature flags, safe runtime configuration, application
version, and Alembic revision. Secret values and encrypted credential bytes are
never serialized. Mutations require CSRF protection and an administrator cannot
suspend its own account.

Ownership endpoints grant an additional owner instead of silently removing
existing owners. This preserves recoverability. Audit history becomes available
through the same control plane when the immutable audit domain is added.
