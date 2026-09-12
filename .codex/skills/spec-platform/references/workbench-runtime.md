# Declarative Workbench runtime and authoring contract

Customer Workbenches are data, not executable extensions. The JSON Schema source in
`contracts/schemas/workbench/v1` is the first validation boundary. The runtime then
resolves every referenced layout, icon, component, binding operation, and action through
closed versioned registries. Standard and customer definitions use the same registry and
renderer. An unknown ID, incompatible major version, invalid region, undeclared action,
or malformed property produces a visible field-addressed diagnostic and never crashes the
shared shell or silently substitutes another asset.

## Rendering and content

- Only schema-valid closed trees are rendered. Registry descriptors own stable IDs,
  allowed regions, property and slot shapes, inputs, outputs, supported states, actions,
  accessibility, and provenance.
- Shared layouts and components receive content from their caller or a named preview
  fixture. Public layouts contain no product-specific sample records.
- Native definitions cannot contain executable expressions, imports, raw CSS or SVG,
  credentials, request headers, or arbitrary network destinations. External executable UI
  remains isolated behind the separately governed MCP App host.
- Runtime errors are recoverable states. Loading, empty, stale, and error remain distinct;
  a stale response may retain validated cached data while clearly showing that it is stale.

## Binding operations

The renderer receives an injected `BindingClient`; it does not import a server SDK or
choose HTTP, MCP, or another transport. A binding references a named, versioned operation
whose exact input and output fields are declared by the host. State mappings can read only
closed dotted paths. Both request input and returned output are validated before use.

Every request is scoped by user, organization, Workspace, Workbench, release, operation,
and validated input. Replacement, context change, and unmount cancel pending work, and a
generation guard rejects replies from transports that ignore cancellation. The bounded
cache uses that complete scope and an operation-defined duration. Refresh bypasses cached
data. Errors never turn malformed output into component input.

The server remains the authorization authority. A browser scope key is isolation context,
not evidence that the caller remains authorized.

## Actions and view state

Definitions may invoke only declared `select`, `toggle`, `refresh`, `submit`, internal
navigation, and dismissal actions supported by the originating component. Payloads are
closed outputs from that component. Internal navigation receives a destination ID, never a
URL. Dispatch rechecks the current context, bounds one in-flight invocation per action, and
reports double submission or failure as recoverable state.

View state version 1 contains controlled selection, tree expansion, sidebar visibility and
width. Browser storage is bounded by the schema and keyed by user, organization, Workspace,
Workbench, and release. Malformed values, another Workbench, stale selection IDs, and stale
expanded IDs are removed. Release changes do not inherit incompatible state. Logout,
account change, and context change must cancel runtime work and select the new scope before
reading state.

## Authoring

The customer editor searches the same asset registry used by the renderer. It inserts,
reorders, and removes only assets allowed in the selected region, exposes descriptor-backed
properties and bindings, supports keyboard operation, and provides bounded undo and redo.
Its preview renders the exact in-memory draft using the same validator and runtime.

Serialization and import validate before replacing the current draft. Parse, validation,
or transport failure retains the draft and identifies offending fields. Theme editing uses
the server-authoritative `ThemeProfile` flow and previews the same resolved theme. Publishing
is intentionally absent until the Workbench domain supplies authorized, revision-checked,
immutable releases; a local preview cannot represent a publication.
