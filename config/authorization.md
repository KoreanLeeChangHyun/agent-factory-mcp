# Authorization policy

Authentication establishes only a user identity. Every tenant operation must
also resolve an organization and, for Workspace resources, a Workspace. The
authorization service applies those values as transaction-local PostgreSQL RLS
context before reading memberships or business records.

Permissions are granted through organization and Workspace roles. Route checks
and application services must both enforce the required permission; hiding a UI
control is not authorization. Platform administration uses a distinct
`platform_admin` identity flag and dedicated dependency.

Documents inherit Workspace authorization in the initial SaaS model. There is
no per-document ACL. Adding one later requires an explicit domain and migration
change rather than interpreting metadata or storage location as authority.
