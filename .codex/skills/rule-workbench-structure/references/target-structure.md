# Accepted Repository Structure

This is the Human-approved target and ownership contract, not a claim that the
working tree has finished migrating. Its Human counterpart is
[the structure specification](../../../../docs/specification/rule-workbench-structure/index.html).

## Fixed root boundary

The managed root directories are `apps/`, `packages/`, `contracts/`, `tests/`,
`scripts/`, `deploy/`, `migrations/`, and `docs/`. No further root directory
addition, removal, or rename is planned or implicitly authorized. Do not invent
another root for a feature, framework convention, or packaging convenience.
If a future requirement cannot fit this structure, explain the reason and
affected paths and obtain an explicit Human decision before changing it.
An explicit instruction already given in the session is sufficient authority;
do not ask again for the same accepted change.

Preserve existing repository metadata and tool directories such as `.git/`,
`.github/`, `.codex/`, `.vscode/`, `.venv/`, `node_modules/`, and caches.
They are not application architecture. Preserve existing local configuration
and ignored data, including `env/`, until an explicitly scoped migration covers
them. Absence from the diagram does not authorize deletion.

## Accepted tree

```text
mcp/
├── apps/
│   ├── api/
│   │   ├── main.py
│   │   ├── routes/
│   │   └── services/
│   ├── web/
│   │   ├── main.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   ├── mcp/
│   │   ├── main.py
│   │   ├── tools/
│   │   ├── resources/
│   │   └── services/
│   └── worker/
│       ├── main.py
│       ├── scheduler.py
│       └── jobs/
├── packages/
│   ├── core/
│   ├── adapters/
│   ├── contracts-py/
│   ├── contracts-ts/
│   ├── design-system/
│   ├── workbench-runtime/
│   └── workbench-editor/
├── contracts/
│   ├── schemas/
│   ├── examples/
│   └── compatibility/
├── tests/
│   ├── api/
│   ├── web/
│   ├── mcp/
│   ├── worker/
│   ├── packages/
│   ├── contracts/
│   ├── integration/
│   └── support/
├── scripts/
│   ├── contracts/
│   └── quality/
├── deploy/
│   └── local/
│       ├── config/
│       ├── env.example
│       ├── deploy.sh
│       ├── rollback.sh
│       └── OPERATIONS.md
├── migrations/
├── docs/
│   ├── original/
│   ├── processed/
│   └── specification/
├── feedback/                 # Human-owned, Git-ignored
├── uploads/                  # Human-owned, Git-ignored
├── .github/workflows/
├── .codex/skills/
└── README.md
```

Root manifests, lockfiles, language configuration, and `.gitignore` stay at the
root. The diagram describes ownership, not every configuration file.
Create directories only when actual files need them. Do not add redundant
`src/<application-or-package-name>/` wrappers. A single router does not require
a `<domain>/router.py` directory. Do not add or rename structural groups beyond
the accepted tree without first explaining the reason and scope to the Human.
Ordinary files and necessary domain groupings within an accepted owner do not
constitute a new root design.

## Application and package ownership

| Owner | Responsibility |
| --- | --- |
| `apps/api` | HTTP inputs, outputs, and API-specific service orchestration |
| `apps/web/pages` | Page-level screens |
| `apps/web/components` | Reusable application UI |
| `apps/web/api` | Browser HTTP request functions, not a server entrypoint |
| `apps/mcp` | MCP tools, resources, transport, and MCP-specific service orchestration |
| `apps/worker` | Asynchronous jobs, scheduler, batches, and periodic work |
| `packages/core` | Shared domain rules, application use cases, and ports |
| `packages/adapters` | Database, storage, queue, secret, and external-service implementations |
| `packages/contracts-py`, `packages/contracts-ts` | Generated language-specific contract code |
| `packages/design-system` | Shared visual foundations, assets, components, and UI language |
| `packages/workbench-runtime` | Shared Workbench interpretation and rendering |
| `packages/workbench-editor` | Shared Workbench editing functionality |

App services coordinate transport-specific workflows. Shared authorization,
validation, state transitions, and business decisions belong to package use
cases; do not duplicate them in API and MCP services. Apps do not import other
apps. Core must not import apps, adapters, frameworks, database libraries,
queues, or provider SDKs. Adapters implement core ports. Preserve tenant
isolation, immutable history, idempotency, runtime authority checks, and external
UI sandbox boundaries when changing wiring.

Choose Python namespaces and build mappings that preserve this physical layout
without shadowing third-party modules such as the official `mcp` SDK.
Do not introduce physical wrapper directories to solve import-name collisions.

## Contracts and tests

`contracts/` owns language-neutral sources. Version actual coexisting contracts,
for example `contracts/schemas/<subject>/v1/`; do not create empty version
scaffolding. Modify source schemas or generators, not generated outputs by hand.

All test code and test-only helpers belong under root `tests/`. Classify by
tested owner first: `api`, `web`, `mcp`, `worker`, or `packages`. Add domain
groupings inside an owner only as needed. `tests/contracts` owns schema,
code-generation, language parity, and compatibility checks.
`tests/integration` owns checks spanning multiple apps; `tests/support` owns
shared fixtures and helpers. Package unit tests belong in `tests/packages`.
This supersedes the former domain-first tree and package-local test placement.

## Scripts and deployment

`scripts/` contains development, code-generation, and verification launchers.
Keep assertions in `tests/`, business logic in `packages/`, and recurring
business work in `apps/worker`. Do not create a folder for one trivial script.

Deploy to the Human's local server now. `deploy/local` owns server configuration
and installation, startup, restart, update, and rollback procedures. Do not
duplicate deployment procedures in `scripts/operations`. Include configuration
only for the deployment mechanism actually selected. Docker and Makefile
execution were retired; this structure does not reintroduce them.
`.github/workflows` connects CI/CD steps. `migrations` owns append-only database
schema history; never rewrite it as part of directory reorganization.

AWS is a future target. Add `deploy/aws` when that migration is undertaken;
no new root is needed. Do not create empty `aws` or `shared` directories now.
Extract shared deployment configuration only when both targets consume it and
the Human accepts the change. Deployment target (`local`, later `aws`) and
operating environment (`dev`, `stg`, `prod`) are independent: a local server
can run production. Keep secrets out of Git; `env.example` contains no secrets.

## Human-owned directories

Root `feedback/` and `uploads/` belong to the Human, not to application code,
deployment output, temporary build storage, or this restructuring task.
Preserve their existing `.gitignore` entries: `/feedback/` and `/uploads/`.
Do not move, rename, delete, clean, repurpose, automatically manage, or force-add
their contents to Git. They remain where the Human uses them. Access or changes
require a separate explicit Human instruction concerning those directories;
general cleanup, deployment, or restructuring authorization does not include them.

Preserve Original, Processed, and Specification ownership under `docs/`.
Historical diagrams do not authorize restoring the old architecture.

## Migration acceptance

Update imports, build/package mappings, resource paths, test discovery, commands,
CI, and maintained references together with a move. Preserve dirty work and data.
Verify affected behavior and packaging, and report pre-existing failures separately.
Recording this specification does not mean source or tests have been relocated.
