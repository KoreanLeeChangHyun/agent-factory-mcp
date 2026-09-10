# Specification Index

Read only the domains touched by the task, but read each selected document completely.

## Platform and security

| Concern | Maintained specifications |
| --- | --- |
| Service boundary and shared cloud integration | [README](../../../../README.md), [cloud platform](cloud-platform.md) |
| Browser identity and sessions | [authentication](authentication.md) |
| Tenant roles, scopes, and delegation | [authorization](authorization.md), [organization management](organization-management.md) |
| Platform administrator surface | [admin](admin.md) |
| Relational persistence and tenant isolation | [database](database.md) |
| Security baseline | [security](security.md) |
| Audit, logs, metrics, and traces | [observability](observability.md) |
| Production release, rollback, backup, and alerts | [operations](operations.md) |

## Workspace domains

| Concern | Maintained specifications |
| --- | --- |
| Workspace lifecycle and navigation | [workspaces](workspaces.md) |
| Workspace UI behavior | [workspace UI](../../rule-ui/references/workspace-ui.md), [UI components](../../rule-ui/references/ui-components.md) |
| Documents, revisions, provenance, and delivery | [documents](documents.md), [cloud documents](cloud-documents.md), [document editor](document-editor.md) |
| Search behavior | [search](search.md) |
| Agent definitions and runs | [agents](agents.md) |
| Durable jobs, schedules, and workers | [workers](workers.md) |
| Planning import | [planning import](planning-import.md) |
| External Agent reports and cloud reporting | [agent reporting](agent-reporting.md), [external reporting](external-agent-reporting.md), [cloud reporting](cloud-reporting.md) |

## Integrations and MCP

| Concern | Maintained specifications |
| --- | --- |
| Provider connections, OAuth, webhooks, and gathering | [integrations](integrations.md), [cloud integrations](cloud-integrations.md) |
| MCP resource and tool policy | [MCP](mcp.md) |
| Workspace connection tokens and file delivery | [MCP connections](mcp-connections.md) |
| Supported MCP clients and compatibility | [MCP clients](mcp-clients.md) |
| Legacy Document migration | [migration](migration.md) |

## Verification contract

Read [testing](../../rule-project/references/testing.md) for required gates. Domain documents may name additional focused scripts or browser tests; those requirements supplement the common gate.

## Historical and implementation evidence

Use these only when the task asks about implementation state, prior decisions, rollout history, or verification evidence:

- `docs/*-audit.md`
- `docs/*-implementation.md`
- `docs/*-rollout.md`
- `docs/*-visual-review.md`
- `docs/organization-github-alignment.md`
- `docs/notes/`

When such evidence contradicts a maintained specification, surface the discrepancy and keep the two categories distinct.
