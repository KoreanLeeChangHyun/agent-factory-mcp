# Workbench refactor stage 5 implementation evidence

## Scope and prior gate

This dated Processed note records the RF-600–604 and RF-508 implementation handoff. It does not
replace the maintained Workbench specification, ADR-003/006/007, or independent Verification.
Stage 4's final pass is recorded in the owning Stage 4 evidence and status documents with its exact
Work/Verification run binding and request hash.

## Authored implementation

- `platform-core` now owns Workspace-scoped definition/release values, action-specific permissions,
  optimistic draft/archive/restore commands, immutable publication, queries, errors, and repository /
  validator ports without framework or database imports.
- `platform-adapters` validates persisted JSON through the generated v1 schema bundle, computes
  canonical schema/definition digests, and implements PostgreSQL CAS, row locks, transactional publish,
  idempotent receipt replay, successful-write audit, and tenant-scoped reads.
- Migration `0026` appends Workbench tables and permissions at the current `0025` head, forces
  Workspace RLS, constrains stored JSON and positive revisions, and rejects release update/delete with
  a database trigger.
- Target HTTP routes and the legacy authenticated/CSRF/RBAC mount use the same use cases. MCP read,
  preview, save, publish, and release tools use the same composition and intersect live RBAC with token
  scopes. Draft content is available only through preview authority; release reads use read authority.
- The React authoring route now loads an authenticated server draft, previews the exact in-memory
  draft, preserves changes on conflict/validation/network failure, disables duplicate saves/publishes,
  reuses an ambiguous publish request key, distinguishes unsaved draft state, and renders the latest
  immutable release separately.
- Focused gates now cover the actual MCPServer schema/error boundary, disposable PostgreSQL
  concurrency, stale writes, idempotent and conflicting publication, immutable release rows,
  failed-audit rollback and cross-tenant RLS, plus authenticated actual-server save, publish,
  reload, keyboard, theme, desktop and narrow authoring behavior without API interception.

## Verification boundary and retained limits

Work did not run tests, type checks, lint, builds, servers, browser automation, migrations, or a
PostgreSQL cluster. Independent Verification must run `scripts/verify-cloud-platform.sh` with the
requested PostgreSQL 16.15 / pgvector 0.6.0 image and the established Workbench checks. The disposable
gate owns clean migration-to-head, forced RLS, concurrency, transactional/immutable release, HTTP/MCP
protocol, permission, and authenticated actual-server browser evidence.

RF-605–607 remain independent substantial existing-domain/adapter/composition ports. Full standard
feature ports, rollout/rollback observation, legacy removal, and remaining global baseline gates are
not completed by this slice.
