# Directory Structure and Ownership

Use the owning directory rather than creating parallel implementations.

| Path | Ownership |
| --- | --- |
| `app/main.py`, `app/api/`, `app/router/` | Application composition, HTTP dependencies, and route adapters |
| `app/modules/<domain>/` | Domain models, schemas, repositories, services, and domain-specific helpers |
| `app/core/` | Cross-cutting settings, security, UI catalog, and application-wide policy code |
| `app/common/` | Small reusable application utilities without domain ownership |
| `app/infrastructure/` | External or persistence adapters shared across domain boundaries |
| `app/mcp/` | MCP transport, resources, tools, and MCP-specific adapters |
| `app/db/migrations/versions/` | Append-only Alembic schema revisions |
| `app/scheduler/`, `app/worker/` | Scheduling and asynchronous execution entry points |
| `app/resources/` | Runtime package data; update `pyproject.toml`/`MANIFEST.in` when packaging changes |
| `template/` | Server-delivered HTML, grouped by product surface |
| `static/css/`, `static/js/`, `static/images/` | Browser assets; feature assets stay with their feature |
| `static/ui/` | Shared generated/copied UI asset runtime; preserve its build/source contract |
| `assets/` | Reusable authoring source assets, not runtime output |
| `tests/` | Python unit/API tests and shared fixtures |
| `tests/integration/` | Tests requiring explicitly supplied infrastructure |
| `tests/browser/` | Browser-level behavior and visual interaction checks |
| `tests/support/` | Shared test-only helpers |
| `scripts/` | Bounded verification and maintenance workflows |
| `deploy/` | Compose, proxy, backup, release, and production deployment assets |
| `docs/` | Dated analysis, audits, rollout records, source kits, and other non-Skill evidence |
| `docs/notes/` | Dated analysis, planning, and verification evidence; not automatically normative |
| `.codex/skills/rule-*/` | Git-owned project conventions and their maintained references |
| `.codex/skills/spec-*/` | Git-owned product/domain contracts and their maintained references |

## Boundaries

- This repository owns the cloud MCP service, Workspace UI, domain persistence, workers, deployment, and their tests.
- The sibling Agent Factory plugin owns distributable `agent` and `convention` Skills and local execution-loop behavior. Do not mirror those contracts here.
- Consumer repositories do not receive this server, browser bundle, or a project-local Workspace runtime.
- `uploads/`, `feedback/`, `exports/`, `.backup/`, caches, build output, and local `.agent-factory/` content are development/runtime artifacts, not authoritative source.
- Keep secrets and credentials out of Git, generated documents, logs, and test fixtures.

## Placement decisions

- Extend an existing domain module before introducing a new top-level package.
- Add a shared abstraction only after at least two real owners need the same behavior and no domain is the natural owner.
- Keep generated assets distinct from their editable source and preserve the existing build step.
- Place a new test beside tests of the same behavior level, not merely beside a similarly named file.
- Do not create a second documentation or Skill tree to solve discoverability; add a route from the owning Skill instead.
