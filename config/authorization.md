# Authorization policy

Authentication establishes a user identity. Every tenant operation resolves an
organization and, for Workspace resources, a Workspace. Authorization establishes
transaction-local PostgreSQL RLS context and verifies active membership and live
Workspace state. Organization membership suspension/removal overrides direct and
team Workspace grants.

`app/modules/organization/permissions.py` owns the permission catalog and built-in
role definitions. Organization roles govern organization operations; Workspace
roles apply only through direct or team membership in the selected Workspace.
Effective permissions are the union of those grants. User-defined roles cannot
include unknown keys, another scope, or owner-only transfer/delete permissions.
The platform admin identity remains separate.

Route dependencies and domain services enforce action permissions. Hiding controls
is not authorization. Delegation checks both existing and proposed roles, including
all Workspace grants affected by team membership changes. Organization owners can
administer assignments; they need Workspace membership to read its content.

MCP contexts contain the intersection of current user permissions and token scopes.
New API tokens require a Workspace binding, token.create, and a scope subset of the
issuer's effective permissions. Legacy token scopes expand to documented action
sets before the intersection, never to organization administration.

Documents inherit Workspace permissions. Per-document ACLs, nested teams, guest
membership and public Workspace joining remain future changes. See
`config/organization-management.md` for lifecycle rules and verification commands.
