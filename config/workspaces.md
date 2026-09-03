# Workspace policy

Workspace is the tenant boundary for Documents, Agents, integrations,
schedules, logs, and tests. An organization owns every Workspace, and an
authenticated user reaches it through organization and/or Workspace
membership. The final Workspace owner cannot be removed.

Source repositories are registered by canonical HTTPS, SSH, or Git identity.
Filesystem locations are accepted only in local and test environments. The
service never creates or reads a project-local `.agent-factory/` directory;
authoritative state belongs to PostgreSQL and object storage.

Workspace reads are safe HTTP operations. Recent-use state is recorded through
an explicit CSRF-protected mutation endpoint. Updates carry a revision and fail
on concurrent modification rather than silently overwriting newer state.
