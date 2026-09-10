# Workspace policy

Workspace is the tenant boundary for Documents, Agents, integrations,
schedules, logs, and tests. Personal Workspaces belong to the individual in the product model. The current
database adapter represents that ownership with an internal personal organization
and owner membership. Organization Workspaces use the same tenant authorization. The final Workspace owner cannot be removed.

Source repositories are registered by canonical HTTPS, SSH, or Git identity.
Filesystem locations are accepted only in local and test environments. The
service never creates or reads a project-local `.agent-factory/` directory;
authoritative state belongs to PostgreSQL and object storage.

Workspace reads are safe HTTP operations. Recent-use state is recorded through
an explicit CSRF-protected mutation endpoint. Updates carry a revision and fail
on concurrent modification rather than silently overwriting newer state.


## Workspace entry and navigation

The organization toolbar remains visible above both the Workspace list view and an
opened Workspace. It contains the product identity, personal/organization selector,
and signed-in profile. A separate Workspace toolbar below it contains the Workspace
selector and persistent create/open menu. Organization changes load only the
selected ownership context through the authenticated API.

The first login has no Workspace selected; later refreshes restore an authorized saved selection. The single Activity Bar shows the Workspace-list icon, and its sidebar
shows actual Workspaces, a name filter, and creation control. The unselected content
area shows the product mark, create/open actions, and server-backed recent
visits. Empty, loading and failed discovery are distinct states with retry.
Opening a Workspace changes the icons in that same Activity Bar and reveals its
Primary Sidebar and Workspace area. The Workspace-list icon remains in that same bar after selection, providing a
return to the Workspace list. There is no separate common-icon group or
second Workspace Activity Bar; the organization toolbar is a separate parent context. Icon visibility and order preferences are keyed by user,
organization and Workspace in browser storage; switching restores the target
Workspace preferences and never inherits a different Workspace's order. Opening the list preserves the selected Workspace and its document views; late
responses from a previously selected Workspace cannot repopulate another one.

Creation asks for a name and uses the selected ownership context. Users with
no personal tenant can create one through the authenticated, CSRF-protected
`POST /api/account/personal-workspaces` operation; the server resolves ownership
from the caller, serializes first-use provisioning, restores caller privileges,
and applies normal Workspace authorization. New external-login users no longer
receive an automatically created Workspace. Existing Workspaces remain intact.

The selected Workspace shows MCP setup in its body until the current user has a
verified connection. Its menu can reopen setup to add or revoke client tokens.
The scoped MCP URL binds the target Workspace on the server; explicit tool IDs
are unnecessary and conflicting IDs are rejected. Successful authenticated MCP
requests establish connection evidence in PostgreSQL. Configuration copy and
installation clicks do not verify a connection. See [MCP connections](mcp-connections.md)
for state, authentication, APIs, VS Code setup and integration verification.
Automatic directory binding and Skill delivery remain separate work.

The runtime uses compact rows, SVG icons, subtle region borders, visible keyboard
focus, native dialogs, and a stacked sidebar/content layout on narrow screens.

Focused checks:

```sh
.venv/bin/pytest tests/test_workspace_ui.py tests/test_workspace_management.py tests/test_authentication.py tests/test_personal_workspaces.py -q
NODE_PATH=<directory-containing-playwright> node tests/browser/workspace-start.cjs
```

The browser check uses synthetic HTTP API fixtures, verifies empty/create/open/
switch/list/error/late-response behavior under `/factory`, and saves desktop and
mobile screenshots under `/tmp/workspace-*.png`. It does not validate a live MCP
client connection or production database provisioning.


## Panel presentation (2026-09-05 revision)

Spacing, typography, indentation and scroll behavior follow [Workspace UI conventions](../../rule-ui/references/workspace-ui.md).

The supplied VS Code screenshot is the visual reference for the complete shell.
The header sits above one Activity Bar and the sidebar/editor grid. Sidebar and
editor surfaces have a 5px gap, 1px neutral borders and 7px corner radii over a
#111111 shell background, with #181818 panel surfaces. Compact titles, 23px
Workspace rows, 52px activity buttons with 8px captions and 24px existing editor tabs preserve the
reference's density. The separator resizes both the list and selected sidebars;
keyboard resizing remains available. Narrow screens stack sidebar and editor.
Split-editor functionality is not added by this visual revision.

The Activity Bar also has a 1px border and rounded corners. Its 60px column
keeps the small Korean captions visible beneath each icon, including Workspace.

Clicking the Workspace-list icon opens the list while retaining the selected
Workspace, its activity icons and loaded document views. Clicking a Workspace
activity returns to that view. Only loading a different ownership context clears the previous selection and
its loaded state. The UI has no separate home or start-screen action.

All authored Korean UI labels use `작업공간`, including the picker, creation,
account and admin views. Workspace identifiers, API paths and stored user names
are unchanged. The picker placeholder opens the list without clearing selection.

Selection and view state survive a refresh in the same browser tab using
sessionStorage keyed by authenticated user and ownership context. Restoration
only uses Workspaces returned by current authorized discovery; missing or
inactive Workspaces discard stale selection. Picker mode keeps the selected
Workspace and its icons. Activity preferences continue to use their separate
user/Workspace keys. No credentials are stored with selection state.
