---
name: rule-ui
description: Design, implement, or audit the Human-facing MCP cloud SaaS interface in this repository using its shared visual system. Use for Workspace screens, navigation, forms, connection flows, responsive layout, and UI consistency work here; do not use for generic web design or plugin UI.
---

# UI Rules

Build one coherent Agent Factory interface: use a VS Code-shaped application shell, AWS Cloudscape-like content grammar, and Agent Factory's own neutral visual identity. References inform decisions; do not import Cloudscape packages, clone AWS styling, or introduce VS Code extension concepts.

## Authority and boundaries

Apply decisions in this order:

1. The user's explicit direction for the current task.
2. Existing Agent Factory information architecture, owner-backed semantics, and repository contracts.
3. This design system.
4. External reference systems.

Keep this Skill Git-owned under `.codex/skills/`. It may later describe or call an MCP capability when that capability exists, but it must not invent tools, data, connection state, or lifecycle authority. Do not add a plugin, top-level Activity, tab, card, or navigation layer merely to accommodate this Skill.

## Choose the work

- For UI implementation or redesign, read [references/design-rules.md](references/design-rules.md) and [references/workspace-ui.md](references/workspace-ui.md) completely before editing.
- For shared controls or UI-kit adapters, also read [references/ui-components.md](references/ui-components.md) and [references/ui-kit-api.md](references/ui-kit-api.md).
- For sidebar design, implementation, or migration, read [references/sidebar-assets.md](references/sidebar-assets.md) completely.
- For UI review or consistency cleanup, read [references/audit-checklist.md](references/audit-checklist.md) completely and report evidence using its format.
- Read both when auditing and fixing the same surface.

## Working method

1. Inspect the existing template, behavior, shared tokens, and focused tests before proposing a new pattern.
2. Preserve user workflows and owner-backed data. Simplify presentation without removing required capability.
3. Reuse `static/css/ui.css` for shared primitives and tokens. Keep feature-specific layout in its feature stylesheet.
4. Prefer the smallest shared abstraction that makes the same meaning look and behave the same everywhere.
5. Verify the affected states at desktop and narrow widths, then run focused runtime and browser tests.

The target is a dense, calm developer tool: clear hierarchy, compact geometry, restrained decoration, consistent actions, and honest system state.
