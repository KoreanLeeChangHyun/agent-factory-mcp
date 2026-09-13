---
name: design-platform
description: Apply Agent Factory's accepted product architecture and technical design for cloud services, Workbenches, Documents, integrations, reporting, planning, organization management, and themes. Use for intended structure and interaction design; use rule-platform for mandatory policy.
metadata:
  specification-id: design-platform
  specification-version: "1"
  projection: ai
  language: en
  counterpart: docs/specification/design-platform/index.html
  semantic-revision: "1"
  sync-base-revision: "1"
  modified-at: "2026-09-14T03:40:00+09:00"
---

# Platform Design

<!-- clause-id: design-platform.scope -->
Use this Skill for integrated planning intent and technical design. `design-*` describes product design, not merely visual styling.

## Resolve the design

<!-- clause-id: design-platform.routing -->
Select only the affected references and read each selected document completely:

- Platform composition: `cloud-platform.md`
- Documents and editor: `cloud-documents.md`, `document-editor.md`
- Connections and collection: `cloud-integrations.md`
- Reporting and planning: `cloud-reporting.md`, `planning-import.md`
- Organization and appearance: `organization-management.md`, `theme-profiles.md`
- Declarative Workbench: `workbench-runtime.md`

<!-- clause-id: design-platform.authority -->
The Human's explicit direction is authoritative. Design documents state accepted intent; implementation and dated evidence do not silently override them. Apply `$rule-platform` for mandatory authorization, persistence, security, API, MCP, worker, and operational behavior.

<!-- clause-id: design-platform.pair -->
The synchronized Human projection is [docs/specification/design-platform/index.html](../../../docs/specification/design-platform/index.html). Update both projections when routing, ownership, or design intent changes.
