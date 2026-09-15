# Directory Structure Contract

Contract ID: `directory-structure-001`  
Version: `5`  
Date: `2026-09-15`  
Owner: `rule-workbench-structure`  
Human counterpart: [contract.html](../../../../docs/specification/rule-workbench-structure/contract.html)  
Structural authority: [target-structure.md](target-structure.md)

## Purpose and status

<!-- clause-id: directory-structure-001.purpose -->
The Human requested a directory structure contract before long-running implementation. This contract records the already accepted structural boundaries and the required process for completing a file-level implementation specification. The overall tree is accepted; the complete target file inventory and per-file implementation specifications are not yet complete or approved. Creating this contract does not authorize source migration or unattended implementation.

## Single source of structural authority

<!-- clause-id: directory-structure-001.authority -->
The accepted tree and directory responsibilities remain owned by references/target-structure.md and its index.html counterpart. This contract adds file-level planning, completion, and change-control requirements; it does not create a competing directory tree. Explicit Human instructions take precedence over historical documentation and legacy implementation. Maintain this English reference and the Korean contract.html together.

## Planning scope

<!-- clause-id: directory-structure-001.scope -->
Cover apps/api, apps/web, apps/mcp, apps/jobs; every accepted package, including the contracts domain (schemas/py/ts) and workbench tool family; tests, scripts, deploy/local, migrations, docs; and affected root manifests, lockfiles, build configuration, CI, and maintained skills. Inventory existing tracked files and relevant nonignored untracked source files at a recorded commit and worktree state. Distinguish current facts, proposed destinations, accepted decisions, missing implementations, and future work. Do not inspect protected Human data as part of the inventory.

## Mandatory placement boundaries

<!-- clause-id: directory-structure-001.boundaries -->
API owns HTTP and API-specific orchestration; MCP owns its own protocol and orchestration; web owns page rendering and browser clients; jobs owns asynchronous, scheduled, and batch entrypoints. Shared business decisions belong in core and infrastructure implementations in adapters. Apps must not import other apps. Core must not depend on adapters or runtime frameworks. Web application components and shared design-system components must have distinct owners; workbench/runtime owns host loading/rendering/bridge validation, workbench/sdk owns the public customer API, workbench/build owns the fixed toolchain inside isolation, and workbench/editor owns code authoring/preview. Jobs application dispatch and adapter-managed isolation are separate from build execution; the build tool is not a new deployed application. Components follow the Human's skeleton + data + theme principle; file separation must express real responsibility, not mechanically create three files for every component.

## Paths, depth, and names

<!-- clause-id: directory-structure-001.depth -->
Specify exact repository-relative file paths, not placeholder trees such as <domain>/service.py. Remove redundant src/package-name wrappers in the planned layout. Do not prescribe identical folders for every domain or create empty scaffolding. Version actual coexisting external contracts when needed; physical path changes do not automatically rename public routes, MCP tool IDs, contract fields, persisted IDs, or migrations. Record Python import namespaces, distribution mappings, TypeScript exports, entrypoints, and packaged resource paths separately from physical paths. The Python MCP application must not shadow the third-party mcp SDK.

## File inventory and migration ledger

<!-- clause-id: directory-structure-001.inventory -->
For each existing in-scope file, record keep, move, split, merge, generated, or separately reviewed retirement. Map every source file to exact destinations or an explicit unresolved record with reason. For a split, name the destination responsibilities and symbols being extracted; for a merge, identify the receiving file and reconciliation work. A missing import target is an implementation gap, not an existing file. Never infer deletion from absence in the target tree. Generated files require an identified source and generator. Do not manually edit generated artifacts.

## Required deliverables and research purpose

<!-- clause-id: directory-structure-001.deliverables -->
Research must support the target structure and code-placement specification, using the Human's [product overview](../../design-platform/references/product-overview.md) as the product basis. Record sources, alternatives, rationale, and unresolved decisions; research is not automatic acceptance. Deliver four linked artifacts within the owning specification: the complete target tree with exact filenames, a directory responsibility table, per-file implementation records, and an existing-to-target file ledger. These are required deliverables, not claims that they have already been written. A folder-only diagram or generic description such as "services contains service code" is insufficient.

## Required per-directory responsibility record

<!-- clause-id: directory-structure-001.directory -->
For every in-scope target directory, record its exact path, owner, purpose, concrete kinds of code it contains, code it must not contain, child directories/files and their record IDs, allowed and forbidden dependencies, and the reason for that level of nesting. Identify the specific services and responsibilities rather than naming only an architectural layer. Configuration, assets, generated output and documentation directories must describe their contents and lifecycle instead of inventing callable interfaces. The tree, directory table, file records and migration ledger must agree, without orphan paths or unexplained files.

## Required per-file implementation record

<!-- clause-id: directory-structure-001.record -->
Each target file record must include: stable record ID and exact path; owning app/package and domain; current source paths and disposition; one-sentence responsibility and explicit exclusions; functions/classes/components/exports to implement with responsibilities; inputs, outputs, schemas and error behavior; allowed dependencies, callers and forbidden dependencies; authorization, tenant isolation, state, transactions, idempotency and side effects where applicable; resource/configuration and generated-source ownership; linked test files and acceptance scenarios; prerequisite record IDs and implementation order; completion criteria, decision status and unresolved questions. Use an explained not-applicable value instead of inventing behavior. Define enough to implement without redesigning ownership; do not prewrite every function body.

## Work sequence and review gates

<!-- clause-id: directory-structure-001.stages -->
Proceed through: (1) baseline inventory and discrepancy report; (2) complete directory and target-file list; (3) per-file implementation records, dependencies, migration ledger and test mapping; (4) Human review and acceptance of the bounded implementation stage; (5) a stage execution contract and solo implementation. A broad later-stage feature may be explicitly deferred, but unresolved files or behavior within the stage to be launched block that stage's readiness. Do not label a partial inventory as a completed repository-wide file specification.

## Planning completion criteria

<!-- clause-id: directory-structure-001.completion -->
The bounded stage is ready only when all its existing files are accounted for; every intended target has a complete record; split/merge ownership and import/export/build/resource mappings are unambiguous; API/MCP/jobs and web/SDK/build/runtime/editor/isolation boundaries are resolved; contracts and generated outputs are traceable; test paths and scenarios are defined; deployment/configuration ownership is recorded; no unapproved deletion or structural change is hidden; and Human review has accepted the stage. Documentation acceptance, source migration, behavior verification, and deployment are separate statuses.

For repository-wide planning to be complete, all four deliverables and every in-scope directory and file record must be complete and reviewed. Explicitly deferred or unresolved items remain visible and prevent claiming a fully finalized file specification. Stage readiness does not imply repository-wide completion. Code restructuring starts only after Human review and acceptance of the corresponding specification and execution scope.

## Change control during implementation

<!-- clause-id: directory-structure-001.changes -->
After stage acceptance, changes to agreed paths, file ownership, public contracts, scope or deletion decisions require a recorded reason, affected records/callers/tests and Human decision before performing that changed portion. Function-body choices within the accepted record remain autonomous; do not seek permission for ordinary implementation already covered by the contract. Continue independent approved work while a changed portion is held. Root additions/removals/renames always follow the accepted root boundary. Document approval does not permit destructive operations, schema-history rewrites or production changes.

## Test deferral and exclusions

<!-- clause-id: directory-structure-001.tests -->
The current task is documentation and read-only inspection only: no production-code moves, implementation, test execution, deployment, data migration, or service changes. The Human deferred product test execution until roadmap stage 8 after the code revamp. Plan test code and acceptance scenarios now; do not claim they passed. Documentation-only inspection is not behavior verification. Deploy locally for now; the exact service manager/proxy/config filenames remain a deployment decision, not an assumed systemd, Docker, or AWS choice. Preserve feedback/, uploads/, ignored secrets, local env/, historical migrations and unrelated changes.

## Long-running execution handoff

<!-- clause-id: directory-structure-001.handoff -->
The later execution contract must identify the accepted file-record revision, exact scope and sequence, completion conditions, autonomous decisions and stop conditions, usage/time budget if chosen, checkpoint policy and handoff artifacts. Work is solo, without subagents. Model choice and numeric budgets are not fixed by this directory contract. The Human's Agent Factory extension is the intended candidate for unattended execution, but independence from Windows/VS Code shutdown remains unverified. Verify that environment separately before relying on it; this document neither starts a background run nor promises uninterrupted operation.
