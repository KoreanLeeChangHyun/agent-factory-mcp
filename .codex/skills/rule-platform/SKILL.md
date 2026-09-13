---
name: rule-platform
description: Apply mandatory Agent Factory platform rules for identity, authorization, persistence, Documents, integrations, MCP, jobs, security, operations, search, and Workspace behavior. Use for implementation and acceptance decisions; use design-platform for architecture intent.
metadata:
  specification-id: rule-platform
  specification-version: "1"
  projection: ai
  language: en
  counterpart: docs/specification/rule-platform/index.html
  semantic-revision: "1"
  sync-base-revision: "1"
  modified-at: "2026-09-14T03:40:00+09:00"
---

# Platform Rules

<!-- clause-id: rule-platform.scope -->
Use this Skill for product behavior and constraints Agents must follow.

## Resolve the rules

<!-- clause-id: rule-platform.routing -->
Read every affected reference completely. Select by concern:

- Identity and authority: `authentication.md`, `authorization.md`, `admin.md`
- Persistence and safety: `database.md`, `security.md`, `observability.md`, `operations.md`
- Workspace knowledge: `workspaces.md`, `documents.md`, `search.md`, `migration.md`
- Execution: `agents.md`, `workers.md`, `external-agent-reporting.md`
- Connections and transport: `integrations.md`, `mcp.md`, `mcp-connections.md`

<!-- clause-id: rule-platform.authority -->
The Human's explicit instruction is authoritative. Keep tenant isolation, immutable history, credential secrecy, idempotency, failure behavior, and paired surfaces explicit. Code and tests are implementation evidence and do not automatically replace these rules.

<!-- clause-id: rule-platform.pair -->
The synchronized Human projection is [docs/specification/rule-platform/index.html](../../../docs/specification/rule-platform/index.html). Update both projections when routing, ownership, or mandatory behavior changes.
