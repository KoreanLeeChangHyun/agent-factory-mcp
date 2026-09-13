---
name: rule-workbench-structure
description: Apply Agent Factory's target Python/TypeScript monorepo structure and dependency boundaries when scaffolding, reorganizing, or porting the MCP cloud Workbench platform. Use for target file placement and migration sequencing; do not use it to infer product behavior or to force a broad migration during an unrelated fix.
---

# Workbench Structure Rules

Build toward the target architecture rather than reshaping the target around the legacy tree.

## Human-approved structure

Read [the accepted tree and ownership contract](references/target-structure.md)
before structural work. Managed root directories are fixed; further root
additions, removals, or renames require an explicit Human decision. Preserve
Human-owned, Git-ignored `feedback/` and `uploads/` under that contract.
The [Human-facing counterpart](../../../docs/specification/rule-workbench-structure/index.html)
records the same structure. Keep both projections synchronized.

## Authority

Apply decisions in this order:

1. The Human's explicit instruction.
2. Current facts from `$info-platform`, accepted architecture from `$design-platform`, and mandatory behavior from `$rule-platform`.
3. The target structure in [references/target-structure.md](references/target-structure.md).
4. Existing implementation patterns only when they do not conflict with the target.

Use `$rule-ui` for Human-facing interface work and `$rule-layout` for the canonical **작업 목록 | 사이드바 | 패널** names. Use `$rule-project` for repository safety, verification, and preservation of unrelated work, but do not let its legacy placement table override an explicitly authorized target-architecture migration.

## Core boundaries

- Put executable and deployable entrypoints in `apps/`.
- Put reusable implementation packages in `packages/`.
- Keep language-neutral JSON Schema sources in `contracts/`.
- Keep all tests under root `tests/`, classified by tested app or package, with shared contract, integration, and support areas.
- Keep HTTP and MCP adapters thin. They call the same Python application use cases.
- Keep API, MCP, web, and worker applications separate while sharing package business logic.
- Make `design-system` the only owner of shared visual foundations, assets, primitives, patterns, shell surfaces, interaction semantics, and common product language.
- Make `workbench-runtime` the only interpreter for customer Workbench definitions.
- Preserve sandbox boundaries for untrusted external UI without inventing another package outside the accepted tree.
- Keep PostgreSQL, queue, object storage, MCP client, HTTP connector, vector, embedding, and secret implementations in `packages/adapters`.
- Do not place framework, database, queue, or provider SDK imports in `packages/core`.

## Scaffolding and porting

Read [references/target-structure.md](references/target-structure.md) completely before creating, moving, or substantially reorganizing target files.

- Create only directories required by the current vertical slice; do not generate an empty final tree.
- Establish contract schemas and dependency checks before moving feature code.
- Port one end-to-end behavior at a time through a compatibility boundary.
- Keep a rollback path until the replacement passes contract, authorization, tenant-isolation, and browser checks.
- Do not combine a large file move, renderer replacement, and product-behavior change in one step.
- Promote shared UI only when its meaning is stable across real consumers. Keep feature-only visualization logic with the feature.
- Generated Python and TypeScript contract packages are build outputs. Change the source JSON Schema instead of editing generated files.
- Preserve published Workbench versions as immutable revisions; migrations append rather than rewrite history.

## Naming

- UI term: `작업` for an item in the `작업 목록` region.
- Domain aggregate: `WorkbenchDefinition`.
- Immutable published snapshot: `WorkbenchRelease`.
- Long-running durable execution: `Job`.
- Do not use generic `task` for both a Workbench definition and a queue job.

## Verification

Verify the smallest affected boundary first, then widen:

1. Schema examples and Python/TypeScript validator parity.
2. Owning package unit tests and dependency-direction checks.
3. HTTP/MCP/worker integration tests for the affected use case.
4. Browser tests for 작업 목록, 사이드바, 패널, state restoration, permissions, and responsive behavior.
5. Build, migration, security, and deployment gates proportional to the change.

Do not claim the target structure is ported merely because directories exist. Completion requires a working vertical slice using the new contracts and dependency direction.

## Current Human instruction: test ownership

All test code and test-only helpers live under root `tests/`. Use the app/package-first classification in [the accepted structure](references/target-structure.md#contracts-and-tests), replacing the former domain-first layout. Do not place tests beside production source. Docker and Makefile execution have been retired; use direct package/runtime commands.
