# ThemeProfile contract

`ThemeProfile` is an authenticated user's server-authoritative appearance preference.
It selects `dark`, `light`, or `high-contrast`, `compact` or `comfortable` density,
an explicit reduced-motion choice, and only the semantic `accent`, `focus`, `surface`,
and `text` color overrides. The API derives `user_id` from the opaque browser session;
clients never select the owner.

## Persistence and revisions

- PostgreSQL stores at most one profile per user. A missing row resolves to the dark,
  compact, motion-enabled default at revision `0`; the first successful write creates
  revision `1`.
- Every update supplies the last observed revision and atomically advances it by one.
  A concurrent first insert or stale update returns HTTP `409` with the current profile.
- The table has forced user RLS. Application authentication remains mandatory.
- Successful writes append `appearance.theme.update` audit metadata containing only the
  resulting revision. Audit failure is urgent operational evidence but does not roll back
  or misreport an already committed profile.

## Validation and accessibility

The contract is closed and bounded. Colors are six-digit hexadecimal values. Server and
browser resolve the selected foundation plus overrides and require at least 4.5:1 text/
surface contrast and 3:1 accent/surface and focus/surface contrast. Unknown tokens, raw
CSS, markup, URLs and invalid values are rejected. User-selected high contrast and reduced
motion override organization or Workspace defaults; these defaults do not replace the
user profile.

## Browser behavior

Browser storage is a versioned, validated initial-paint cache, keyed by user,
organization and Workspace. It is never write authority. The authenticated identity is
resolved before reading it, the server response reconciles the whole surface, and stale
requests are discarded. Logout, account switch and context switch cancel pending reads
and must not apply another context's cache. Storage failure does not block the server path.

Preview applies to the shared React shell, native Workbench and authoring surface
immediately. A failed or conflicting save keeps the user's draft, states that it is not
saved, and offers an explicit server-version recovery action. Sandboxed MCP Apps receive
only a read-only resolved theme context through their future host boundary.
