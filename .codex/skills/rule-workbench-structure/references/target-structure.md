# Target Workbench Repository Structure

This is the maintained file-placement and dependency contract for the Agent Factory MCP cloud Workbench target architecture.

## Top-level map

```text
agent-factory/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── design-system/
│   ├── workbench-runtime/
│   ├── mcp-app-host/
│   ├── contracts-ts/
│   ├── contracts-py/
│   ├── platform-core/
│   └── platform-adapters/
├── contracts/
├── migrations/
├── tests/
├── deploy/
├── docs/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── pyproject.toml
├── uv.lock
└── Makefile
```

| Path | Owner |
| --- | --- |
| `apps/web` | React browser application and product composition |
| `apps/api` | FastAPI HTTP and MCP composition roots |
| `apps/worker` | Worker and scheduler process entrypoints |
| `packages/design-system` | Shared UI foundations, assets, components, patterns, and language |
| `packages/workbench-runtime` | Declarative Workbench validation, registry, rendering, bindings, actions, and view state |
| `packages/mcp-app-host` | Sandboxed external MCP App lifecycle and policy |
| `packages/contracts-ts` | Generated TypeScript contract types and validators |
| `packages/contracts-py` | Generated Python contract types and validators |
| `packages/platform-core` | Framework-independent domains and application use cases |
| `packages/platform-adapters` | PostgreSQL, pgvector, Redis, object storage, MCP, HTTP, embedding, and secret adapters |
| `contracts` | Language-neutral schema source and compatibility fixtures |
| `migrations` | Append-only PostgreSQL schema history |
| `tests` | Cross-boundary tests only |
| `deploy` | Containers, local stacks, proxy, deployment, smoke, backup, and restore |
| `docs` | Product specifications, ADRs, and runbooks |

## Web application

```text
apps/web/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── error-boundary.tsx
│   ├── shell/
│   │   ├── WorkbenchShell.tsx
│   │   ├── TaskList.tsx
│   │   ├── SidebarHost.tsx
│   │   ├── PanelHost.tsx
│   │   ├── shell-state.ts
│   │   └── shell-storage.ts
│   ├── registry/
│   │   ├── WorkbenchRegistry.ts
│   │   ├── standard-workbenches.ts
│   │   └── customer-workbenches.ts
│   ├── standard/
│   │   ├── workspace/
│   │   ├── documents/
│   │   ├── knowledge/
│   │   ├── connections/
│   │   ├── jobs/
│   │   └── audit/
│   ├── authoring/
│   │   ├── WorkbenchListPage.tsx
│   │   ├── WorkbenchEditorPage.tsx
│   │   ├── WorkbenchPreview.tsx
│   │   ├── ComponentPalette.tsx
│   │   ├── PropertyEditor.tsx
│   │   ├── BindingEditor.tsx
│   │   └── SchemaDiagnostics.tsx
│   ├── api/
│   ├── auth/
│   ├── state/
│   ├── telemetry/
│   ├── styles/
│   └── test/
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

The shell owns three-region layout, navigation, selection, and responsive behavior. It does not interpret customer JSON. Standard features own product-specific projections, not shared primitives.

## API and worker applications

```text
apps/api/
├── src/agent_factory_api/
│   ├── main.py
│   ├── lifespan.py
│   ├── settings.py
│   ├── composition/
│   ├── http/
│   │   ├── router.py
│   │   ├── dependencies/
│   │   ├── routes/
│   │   │   ├── sessions.py
│   │   │   ├── organizations.py
│   │   │   ├── workspaces.py
│   │   │   ├── workbenches.py
│   │   │   ├── workbench_releases.py
│   │   │   ├── connections.py
│   │   │   ├── knowledge.py
│   │   │   ├── jobs.py
│   │   │   └── audit.py
│   │   ├── presenters/
│   │   └── middleware/
│   ├── mcp/
│   │   ├── server.py
│   │   ├── transport.py
│   │   ├── context.py
│   │   ├── resources/
│   │   └── tools/
│   └── health/
├── tests/
├── pyproject.toml
└── Dockerfile

apps/worker/
├── src/agent_factory_worker/
│   ├── main.py
│   ├── scheduler.py
│   ├── settings.py
│   ├── composition.py
│   ├── claim.py
│   ├── cancellation.py
│   └── handlers/
│       ├── source_sync.py
│       ├── document_parse.py
│       ├── chunk_documents.py
│       ├── create_embeddings.py
│       ├── rebuild_index.py
│       ├── refresh_binding.py
│       └── retention.py
├── tests/
├── pyproject.toml
└── Dockerfile
```

Routes, tools, and resources translate transport inputs and outputs. They do not own SQL, transactions, authorization policy, or domain state transitions. Worker handlers resolve authoritative Job and tenant state before calling `platform-core`; they do not trust tenant identity from queue payloads.

## Design system

```text
packages/design-system/
├── src/
│   ├── foundations/
│   │   ├── tokens/
│   │   ├── themes/
│   │   ├── reset.css
│   │   └── global.css
│   ├── assets/
│   │   ├── brand/
│   │   ├── icons/
│   │   └── illustrations/
│   ├── primitives/
│   ├── navigation/
│   ├── data-display/
│   ├── layout/
│   ├── patterns/
│   ├── shell/
│   ├── content/
│   └── accessibility/
├── catalog/
├── scripts/
├── tests/
├── package.json
└── tsconfig.json
```

- Foundations own color, spacing, typography, geometry, elevation, motion, and z-index tokens.
- Assets own reviewed brand marks, icons, provenance, and only necessary illustrations.
- Primitives own controls and state semantics.
- Patterns own repeated resource, form, empty, error, and permission presentations.
- Shell owns reusable surfaces for 작업 목록, 사이드바, and 패널, not product navigation state.
- Content owns canonical Korean nouns, actions, and status labels.
- Accessibility owns shared focus, keyboard, and live-region behavior.

Native customer Workbenches must use registered design-system components. They cannot supply raw CSS, arbitrary SVG, or React import paths. MCP Apps may receive host theme context and read-only token CSS, but remain visually and technically isolated.

## Workbench runtime and MCP App host

```text
packages/workbench-runtime/
├── src/
│   ├── registry/
│   │   ├── ComponentRegistry.ts
│   │   ├── ActionRegistry.ts
│   │   └── BindingRegistry.ts
│   ├── renderer/
│   │   ├── WorkbenchRenderer.tsx
│   │   ├── SidebarRenderer.tsx
│   │   ├── PanelRenderer.tsx
│   │   ├── ComponentNode.tsx
│   │   └── RenderBoundary.tsx
│   ├── bindings/
│   ├── actions/
│   ├── state/
│   ├── validation/
│   ├── security/
│   └── telemetry/
├── tests/
├── package.json
└── tsconfig.json

packages/mcp-app-host/
├── src/
│   ├── host/
│   ├── sandbox/
│   ├── messaging/
│   └── policy/
├── tests/
├── package.json
└── tsconfig.json
```

The runtime accepts a `BindingClient` port instead of choosing HTTP or MCP transport. Public component identifiers are stable and versioned, such as `resource-table@1`; definitions never contain implementation imports.

The MCP App host alone owns iframe sandbox attributes, CSP intersection, capability negotiation, origin/source/message validation, bridge lifecycle, downloads, external links, and teardown.

## Contracts

```text
contracts/
├── schemas/
│   ├── common/v1/
│   ├── workbench/v1/
│   │   ├── definition.schema.json
│   │   ├── release.schema.json
│   │   ├── descriptor.schema.json
│   │   ├── sidebar.schema.json
│   │   ├── panel.schema.json
│   │   ├── component.schema.json
│   │   ├── binding.schema.json
│   │   ├── action.schema.json
│   │   └── view-state.schema.json
│   ├── events/v1/
│   └── mcp/v1/
├── examples/
│   ├── stocks/
│   ├── knowledge-search/
│   └── invalid/
├── compatibility/
└── codegen/

packages/contracts-ts/
└── src/generated/

packages/contracts-py/
└── src/agent_factory_contracts/generated/
```

JSON Schema is authoritative. Each object is closed unless extensibility is explicitly designed. Bound depth, size, component count, string length, and validation time. Forbid external references, executable expressions, credentials, raw headers, and arbitrary URLs in Workbench definitions.

## Python core and adapters

```text
packages/platform-core/
└── src/agent_factory_core/
    ├── shared/
    ├── identity/
    ├── organizations/
    ├── workspaces/
    ├── workbenches/
    │   ├── domain.py
    │   ├── commands.py
    │   ├── queries.py
    │   ├── policies.py
    │   ├── ports.py
    │   ├── events.py
    │   └── errors.py
    ├── connections/
    ├── knowledge/
    ├── executions/
    └── audit/

packages/platform-adapters/
└── src/agent_factory_adapters/
    ├── postgres/
    ├── pgvector/
    ├── redis/
    ├── object_storage/
    ├── mcp_client/
    ├── http_connectors/
    ├── embeddings/
    └── secrets/
```

Use vertical slices inside `platform-core`. Avoid global `models/`, `services/`, and `repositories/` folders that mix domain ownership. `platform-adapters` implements core ports; the core never imports adapters.

## Tests, deployment, and documentation

```text
tests/
├── contracts/
├── integration/
│   ├── postgres/
│   ├── mcp/
│   ├── queue/
│   ├── object_storage/
│   └── providers/
├── e2e/
│   ├── author-publish-render.spec.ts
│   ├── stocks-workbench.spec.ts
│   ├── tenant-isolation.spec.ts
│   ├── mcp-app-sandbox.spec.ts
│   └── responsive-keyboard.spec.ts
└── security/
    ├── schema-limits/
    ├── cross-tenant/
    ├── ssrf/
    ├── csp/
    └── postmessage/

deploy/
├── containers/
├── compose/
├── kubernetes/
├── proxy/
├── smoke/
└── backup/

docs/
├── specs/
├── adr/
└── runbooks/
```

Package tests own unit behavior. Root tests prove cross-boundary contracts. Dated research and migration evidence are not current product specifications.

## Allowed dependency direction

```text
apps/web ───────────────> workbench-runtime ───> design-system
   │                              │                    │
   ├──────────────────────────────┴────────────────────┤
   ├──────────────> contracts-ts <────────────────────┘
   └──────────────> mcp-app-host ─> contracts-ts

apps/api ─────┐
              ├──> platform-core ─────> contracts-py
apps/worker ──┘          ▲
                         │ implements ports
                 platform-adapters
```

Reject these directions:

- `platform-core` to FastAPI, Celery, SQLAlchemy, Redis, MCP SDK, or provider SDKs.
- `design-system` to product features or data clients.
- `workbench-runtime` to a particular standard Workbench.
- HTTP routes directly to persistence adapters.
- Worker handlers to other worker handlers.
- Contracts to implementation code.
- Customer definitions to raw CSS, raw icons, code imports, secrets, or arbitrary network targets.

## Initial vertical slice

Do not create the complete empty tree. The first scaffold should contain only what is needed for:

```text
apps/web
apps/api
apps/worker
packages/design-system
packages/workbench-runtime
packages/contracts-ts
packages/contracts-py
packages/platform-core/workbenches
packages/platform-adapters/postgres
contracts/schemas/workbench/v1
contracts/examples/stocks
tests/contracts
tests/e2e
```

The first completion proof is a schema-validated `주식` Workbench fixture that appears in 작업 목록, selects a symbol in the 사이드바, and renders validated fixture data in the 패널 using design-system components. A real market-data provider is a later connection slice.

