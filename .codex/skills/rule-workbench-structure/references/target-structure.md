# Accepted Repository Structure

This is the Human-approved target and ownership contract, not a claim that the
working tree has finished migrating. Its Human counterpart is
[the structure specification](../../../../docs/specification/rule-workbench-structure/index.html).

File-level planning and research follow the [directory structure contract](directory-contract.md).
The tree below is not a substitute for its directory and file implementation records.

## Fixed root boundary

The managed root directories are `apps/`, `packages/`, `tests/`,
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

The Human explicitly requested these supporting root directories in the target tree:
- `env/local/dev/`, `stg/`, and `prod/` own real environment values and secrets,
  excluded from Git. `deploy/` owns procedures and secret-free examples instead.
  Add `env/aws/` only when AWS migration begins. Do not relocate existing values
  merely because the target layout is now documented.
- `.codex/` owns project configuration and English AI specifications in Skills.
- `.github/` owns CI/CD workflows and issue/pull-request templates.
- `.vscode/` owns editor, debug, development-command and extension configuration.
Only shareable tool configuration belongs in Git; personal settings, tokens and
secrets do not. Listed template/editor files describe target placement, not
permission to overwrite existing files or create unused scaffolding.

## Consolidated product and research status

Updated: 2026-09-15. The Human accepted the code-based custom-work structure, including
separate workbench/sdk and workbench/build packages. The Human has now consolidated root contracts into packages/contracts and grouped Workbench tools under packages/workbench; app boundaries remain unchanged. The expanded internal paths below are
a reviewable placement design, not a completed file inventory or authorization to implement.
[Candidate] marks a research-derived feature or mechanism, not an accepted requirement.
Other expanded paths map accepted features to proposed code owners; their exact filenames
still require file-level review. Do not create empty directories from this tree.

- Accepted: cloud agent supervision; standard and user-authored code-based custom work with shared
  assets and SDK; optional sidebar and panel tabs; platform compilation/rendering of custom work;
  workspace MCP; external database connectivity.
- Accepted: Personal is single-user with one free workspace and additional count-based subscription;
  no organization work or invitations. Team means an organization, not a nested team.
  Organization owners invite users, grant access and administrator powers, and compose permission
  sets for users. Enterprise is differentiated by security; exact features and prices remain open.
- Accepted: configurable usage metering and resource limits independent of billing. System defaults
  and organization/workspace limits are managed without pricing or automatic overage charges.
- Research proposals: registered server data operations, PostgreSQL-first/read-first rollout,
  private-network connection mechanisms, billing ownership, role-merging semantics, SSO/SCIM,
  audit exports and other enterprise security features. None is automatically accepted here.
- Source: [product overview](../../design-platform/references/product-overview.md).
  Evidence and alternatives: [external data research](../../../../docs/processed/external-db-custom-work-research.html)
  [SaaS research](../../../../docs/processed/saas-plans-organization-permissions-research.html),
  and [custom-code research](../../../../docs/processed/custom-work-code-runtime-research.html).
  Earlier research placements are historical proposals; this accepted structure supersedes them.

## Cross-domain ownership and unresolved boundaries

- A standard work item is a screen entry, not necessarily one business domain. Organization uses
  organizations and identity; account uses identity and candidate billing; DB uses connections
  and candidate data_access; logs uses audit and reporting; tests work has not yet acquired a
  separately approved execution domain. Root tests/ remains verification code, never product data.
- agents, planning, scheduling and reporting are proposed direct children of core, replacing the
  executions wrapper; knowledge remains the document domain. Existing classes/imports/history
  must be mapped before moves. The diagram does not retire unlisted functionality.
- Connection lifecycle has one core owner even if Connections and DB both expose it. External DB
  access must not share the platform DB authority or silently create customer schemas.
- Permission catalog, organization-defined permission sets and scoped user grants belong to
  organizations, while identity applies the shared authorization contract. Membership, ownership,
  subscription entitlements and effective permissions are distinct. No nested team domain is added.
- Workbench definitions/releases/configuration belong to workbenches; the reusable renderer is
  workbench/runtime. Personal or organization custom definitions are data/artifacts, not source
  directories named after each customer. Definition ownership, workspace activation and user display
  preferences are distinct design axes; exact sharing/inheritance rules remain open.
- Custom work uses user-authored code, shared UI assets and a public SDK. TypeScript/React is the
  planning baseline; exact versions, bundler, dependency allowlist and isolation technology remain
  unresolved. JSON describes registration and protocol contracts, not the only allowed UI format.
- workbench/sdk owns the customer-facing API; workbench/runtime owns host loading, rendering and
  message checks. workbench/build owns the fixed toolchain running inside an isolated environment.
  The jobs application dispatches builds; adapters provision, invoke, cancel and reclaim that environment.
  Do not execute customer builds inside the ordinary worker process. Arbitrary server-side customer
  functions are not implicitly included. These two package additions were explicitly accepted.
- Source snapshots and immutable artifacts are runtime storage data, not per-customer repository
  folders. Metadata, ownership, publication and workspace activation belong to core/workbenches.
  Build completion, publication and activation are separate states; activation pins a release.
- UI components follow skeleton + data + theme. Sidebar and panel tabs are independently optional.
  The design system owns reusable UI; browser clients and runtime bindings never receive DB secrets.
  `packages/design-system/assets/` owns shared icons, logos, fonts and source images.
  Web and custom work consume the design-system public asset surface, not independently maintained copies.
- Enterprise is currently a plan/security distinction, not a new parent entity above organizations.
  SSO, SCIM, session controls, billing adapters and service identities need separate decisions and
  exact records before new implementation files are included.
- Domain routes and services not individually enumerated below must still receive exact file records
  in the next specification pass. Templates, manifests, assets, test cases and existing-to-target
  mappings are not complete merely because representative files are shown.

## Chat and editing scope — file planning 2026-09-15

Human chat is the product requirement; agents only read authorized conversations through MCP.
Do not add agent message-send tools, always-on subscriptions or agent activation. Human real-time
delivery and MCP pull queries are separate paths. Chat UI is app-specific supporting UI for now;
its navigation location is undecided, not an eleventh standard work item.
Channel scope, membership, edits/deletes, retention, read receipts and attachments remain decisions.
Durable event relay is a proposal to close storage-to-delivery gaps, not a selected transport.

Optimistic revision checking is the proposed initial editing behavior. Real-time shared cursors and
CRDT/OT collaboration are not approved. Keep conflict handling with the edited domain; do not add
a generic collaboration service merely because several users can save the same object.

The [file planning draft](../../../../docs/processed/structure-file-plan.html) and
[baseline ledger](../../../../docs/processed/structure-migration-ledger.html) distinguish observed
sources, candidate mappings and pending design. They are not approved implementation records.
The [service-boundary design draft](../../../../docs/processed/service-boundary-design.html)
compares domain ownership, service deployment and database separation. It is a
review proposal, not approval to replace this tree or move production code.
These Processed snapshots predate the accepted contracts/workbench grouping and worker-to-jobs application rename. Their
old destination paths require remapping before implementation; baseline source paths
remain historical evidence and must not be rewritten as if files had already moved.
The tree now names additional target files, but no source move or complete repository specification
is claimed. Existing omitted files are preserved and tracked in the ledger.

## Expanded target tree

```text
mcp/ # Target structure; detailed placements pending review
├── apps/ # Executable applications
│   ├── api/ # HTTP entrypoints and orchestration
│   │   ├── main.py # HTTP composition and lifecycle
│   │   ├── settings.py # API-only validated configuration
│   │   ├── composition/ # API dependency wiring not shared business logic
│   │   │   ├── chat.py # Compose chat persistence authorization and event services
│   │   │   └── usage.py # Compose usage repositories and capacity admission
│   │   ├── routes/ # Domain HTTP input/output
│   │   │   ├── organizations.py # Organization membership and permission APIs
│   │   │   ├── workspaces.py # Personal and organization workspace APIs
│   │   │   ├── workbenches.py # Source build request publication and activation APIs
│   │   │   ├── identity.py # Identity and session APIs
│   │   │   ├── connections.py # Connection management APIs
│   │   │   ├── data_access.py # [Candidate] External data operation APIs
│   │   │   ├── usage.py # Authorized usage queries and limit configuration
│   │   │   ├── chat.py # Human chat commands and authorized history queries
│   │   │   ├── chat_events.py # Human-client event stream admission resume and teardown
│   │   │   ├── billing.py # [Candidate] Future subscription APIs not runtime limit enforcement
│   │   │   └── admin.py # Platform administrator APIs
│   │   └── services/ # HTTP orchestration calling shared use cases
│   ├── web/ # Control tower browser application
│   │   ├── main.tsx # Browser entrypoint
│   │   ├── App.tsx # Compose work list optional sidebar and panel
│   │   ├── pages/ # Standard work screens
│   │   │   ├── organizations/ # Organization membership and permission-set management
│   │   │   │   └── OrganizationWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── workspaces/ # Workspace selection and management
│   │   │   │   └── WorkspaceWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── schedule/ # Schedule screens
│   │   │   │   └── ScheduleWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── agents/ # Agent supervision screens
│   │   │   │   └── AgentsWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── documents/ # Document exploration and editing
│   │   │   │   └── DocumentsWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── connections/ # Integration registration and status
│   │   │   │   └── ConnectionsWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── logs/ # Authorized operational and work history
│   │   │   │   └── LogsWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── tests/ # Product verification work screens
│   │   │   │   └── TestsWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── db/ # External database and data management screens
│   │   │   │   └── DatabaseWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   ├── account/ # Own account and personal subscription
│   │   │   │   └── AccountWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   │   └── admin/ # Platform administration including usage and limit adjustment
│   │   │       └── AdminWorkbench.tsx # Standard screen entry; detailed behavior pending
│   │   ├── components/ # Application-only reusable UI
│   │   │   ├── WorkbenchHost.tsx # Work list optional sidebar and panel composition
│   │   │   └── chat/ # App-specific chat UI; navigation placement undecided
│   │   │       ├── ChatPanel.tsx # Human conversation history and send UI
│   │   │       └── chat-state.ts # Deduplication cursor and pending-send state
│   │   └── api/ # Domain HTTP clients without secrets
│   │       ├── chat.ts # History send and reconnect client
│   │       └── usage.ts # Usage query and authorized configuration client
│   ├── mcp/ # Independent workspace MCP applying shared request limits
│   │   ├── main.py # MCP server composition and lifecycle
│   │   ├── settings.py # Independent MCP configuration
│   │   ├── composition.py # MCP-owned dependency assembly without API imports
│   │   ├── auth.py # Token scope adaptation to shared authorization
│   │   ├── tools/ # Authorized domain MCP tools
│   │   │   ├── workbenches.py # Workbench tools with separately specified scope
│   │   │   ├── chat.py # Read-only authorized chat history and changes
│   │   │   └── data_access.py # [Candidate] Registered data operation calls
│   │   ├── resources/ # Authorized workspace resources
│   │   └── services/ # MCP orchestration calling shared use cases
│   └── jobs/ # Async jobs scheduler and shared execution concurrency limits
│       ├── main.py # Worker process entrypoint
│       ├── settings.py # Worker configuration and queue limits
│       ├── composition.py # Worker handler and adapter wiring
│       ├── celery_app.py # Explicit Celery app and bounded handler registration
│       ├── scheduler.py # Periodic dispatch
│       └── jobs/ # Job handlers with current authorization checks
│           ├── data_access.py # [Candidate] Long data operations and exports
│           ├── chat_events.py # Candidate durable chat event relay; not agent activation
│           ├── usage_reconcile.py # Capacity expiry and reconciliation dispatch
│           └── workbench_build.py # Dispatch isolated builds and handle state and results
├── packages/ # Shared implementation with domain ownership
│   ├── core/ # Business rules use cases and ports
│   │   ├── identity/ # Identity and shared authorization
│   │   ├── organizations/ # Organizations invitations membership permission sets and grants
│   │   │   ├── permissions.py # Permission catalog and allowed scope definitions
│   │   │   ├── permission_sets.py # Permission set composition and validation
│   │   │   └── grants.py # User permission-set and resource-scope grants
│   │   ├── workspaces/ # Personal and organization workspace rules
│   │   ├── workbenches/ # Source build publication and activation business rules
│   │   │   ├── definitions.py # Source snapshots drafts and ownership rules
│   │   │   ├── builds.py # Build requests and state transitions
│   │   │   ├── releases.py # Immutable publication versions and compatibility
│   │   │   ├── activations.py # Workspace release selection and rollback
│   │   │   ├── policies.py # Author publish activate and execute permissions
│   │   │   ├── ports.py # Persistence artifact and isolated build interfaces
│   │   │   └── use_cases.py # Shared business workflows
│   │   ├── agents/ # Agent business rules
│   │   ├── planning/ # Planning and calendar rules
│   │   ├── scheduling/ # Scheduling execution and retry rules
│   │   ├── reporting/ # Execution reports and result collection rules
│   │   ├── knowledge/ # Document search package and history rules
│   │   ├── connections/ # Connection ownership state and credential lifecycle
│   │   ├── chat/ # Human chat and read-only agent access domain
│   │   │   ├── channels.py # Conversation identity and membership model
│   │   │   ├── messages.py # Message identity revisions and ordering
│   │   │   ├── policies.py # Human send and scoped read authorization
│   │   │   ├── ports.py # History transaction and event delivery contracts
│   │   │   └── use_cases.py # Send read and change-query workflows
│   │   ├── data_access/ # [Candidate] External data operation policies
│   │   │   ├── domain.py # [Candidate] Operation versions and execution state
│   │   │   ├── ports.py # [Candidate] Execution introspection and persistence ports
│   │   │   ├── policies.py # [Candidate] Input scope and execution limits
│   │   │   └── use_cases.py # [Candidate] Register publish execute and cancel
│   │   ├── usage/ # Metering and configurable resource limits independent of billing
│   │   │   ├── metrics.py # Metric identities units and measurement semantics
│   │   │   ├── limits.py # System defaults and organization workspace limit settings
│   │   │   ├── policies.py # Effective limit resolution and exceedance decisions
│   │   │   ├── ports.py # Metering persistence and atomic capacity lease interfaces
│   │   │   └── use_cases.py # Query configure acquire renew and release capacity
│   │   ├── billing/ # [Candidate] Future subscriptions and plan entitlements not metering
│   │   ├── appearance/ # Theme configuration rules
│   │   ├── audit/ # Membership permission and execution audit
│   │   ├── administration/ # Platform operator use cases
│   │   └── shared/ # Minimal truly shared domain foundations
│   ├── adapters/ # Infrastructure and provider implementations
│   │   ├── postgres/ # Platform persistence tenant isolation limit settings and usage history
│   │   │   ├── chat.py # Chat persistence cursor queries and transactional event records
│   │   │   └── usage.py # Limit settings history and durable metering persistence
│   │   ├── identity/ # Cryptography and identity provider integration
│   │   ├── external_db/ # [Candidate] Customer DB access separate from platform DB
│   │   │   ├── postgres.py # [Candidate] External PostgreSQL driver
│   │   │   ├── pools.py # [Candidate] Scoped pool lifecycle and limits
│   │   │   └── network.py # [Candidate] Destination TLS and network checks
│   │   ├── redis/ # Queue shared state atomic usage counters and expiring capacity leases
│   │   │   ├── chat_events.py # Ephemeral event fanout not authoritative chat history
│   │   │   └── usage.py # Atomic counters capacity leases renewal and release
│   │   ├── object_storage/ # Documents customer source snapshots and immutable artifacts
│   │   ├── workbench_build.py # Isolated build environment provision invoke cancel and reclaim
│   │   ├── mcp_client/ # External MCP client
│   │   ├── http_connectors/ # External API provider clients
│   │   ├── embeddings/ # Embedding providers
│   │   └── pgvector/ # Document vector search
│   ├── contracts/ # Data contract domain owning sources and generated language code
│   │   ├── schemas/ # Schemas versioned when coexisting
│   │   │   ├── workbench/ # Registration SDK messages releases and view contracts
│   │   │   │   ├── v1/ # Preserve existing declarative contracts until mapped migration
│   │   │   │   └── v2/ # Proposed code-based contract version; not implemented
│   │   │   │       ├── manifest.schema.json # Code entrypoints capabilities and compatibility
│   │   │   │       ├── bridge.schema.json # SDK request response event and cancellation
│   │   │   │       └── release.schema.json # Source build and artifact release metadata
│   │   │   ├── catalog/ # Component and asset catalog contracts
│   │   │   ├── appearance/ # Theme contracts
│   │   │   ├── usage/ # Usage limit and exceedance error contracts
│   │   │   │   └── v1/ # Proposed first usage contract
│   │   │   │       ├── limit.schema.json # Scoped metric unit and limit settings
│   │   │   │       └── result.schema.json # Usage snapshots admission and exceedance results
│   │   │   ├── chat/ # Human chat and read-only MCP data contracts
│   │   │   │   └── v1/ # Proposed first chat contract
│   │   │   │       ├── message.schema.json # Message record and bounded send input
│   │   │   │       └── page.schema.json # History changes and opaque continuation cursor
│   │   │   └── data-access/ # [Candidate] Data operation contracts
│   │   ├── py/ # Python contracts with generated-source traceability
│   │   ├── ts/ # TypeScript contracts with generated-source traceability
│   │   ├── examples/ # Contract examples without sensitive data
│   │   └── compatibility/ # Version compatibility fixtures
│   ├── design-system/ # Shared skeleton data interfaces theme and assets
│   │   ├── components/ # Shared work list sidebar panel and primitives
│   │   ├── theme.tsx # Theme provision and switching
│   │   ├── tokens.css # Shared visual tokens
│   │   └── assets/ # Shared UI assets: icons logos fonts and source images
│   └── workbench/ # Workbench tool family with independent child package boundaries
│       ├── sdk/ # Public API imported by customer code not host internals
│       │   ├── index.ts # Public exports
│       │   ├── client.ts # Host communication client
│       │   ├── data.ts # Authorized data operation requests
│       │   ├── actions.ts # Execution and navigation requests
│       │   ├── context.ts # View context and change subscriptions
│       │   └── theme.ts # Host theme connection
│       ├── build/ # Fixed toolchain executed inside isolation
│       │   ├── main.ts # Internal build tool entrypoint
│       │   ├── validate.ts # Source manifest and dependency policy checks
│       │   ├── typecheck.ts # Type diagnostics
│       │   ├── bundle.ts # Fixed-toolchain bundling
│       │   └── artifact.ts # File inventory hashes and build metadata
│       ├── runtime/ # Platform-side loading rendering and lifecycle
│       │   ├── renderer.tsx # Select trusted standard or isolated custom rendering
│       │   ├── SandboxHost.tsx # Isolated view lifecycle and recovery mechanism undecided
│       │   ├── bridge.ts # Validate SDK messages and mediate allowed operations
│       │   ├── bindings.ts # Host-side data binding and cancellation
│       │   ├── actions.ts # Host-side operation dispatch not server authorization
│       │   ├── registry.ts # Work asset and compatibility lookup
│       │   └── view-state.ts # Sidebar panel state coordination and restoration
│       └── editor/ # Customer code authoring environment
│           ├── WorkbenchEditor.tsx # Editing preview and publication UI
│           ├── preview.tsx # Draft preview using the same isolated runtime
│           └── diagnostics.ts # File line column and stage diagnostics
├── tests/ # All tests classified by app or package
│   ├── api/ # API tests
│   ├── web/ # Web and browser tests
│   ├── mcp/ # MCP tests
│   ├── jobs/ # Worker and scheduler tests
│   ├── packages/ # Package tests including usage limits concurrency and lease recovery
│   ├── contracts/ # Contract generation parity and compatibility tests
│   ├── integration/ # Cross-application tests
│   └── support/ # Shared test fixtures and helpers
├── scripts/ # Development generation and verification launchers
│   ├── contracts/ # Contract generators
│   └── quality/ # Quality launchers and configuration
├── deploy/ # Deployment target procedures and configuration
│   └── local/ # Current local-server target
│       ├── dev/ # Development environment configuration and resource references
│       ├── stg/ # Staging environment configuration and resource references
│       ├── prod/ # Production environment configuration and resource references
│       ├── config/ # Local services build isolation artifact serving and server resource ceilings
│       ├── env.example # Secret-free configuration example
│       ├── deploy.sh # Installation and update procedure
│       ├── rollback.sh # Release rollback procedure
│       └── OPERATIONS.md # Operational and recovery guide
├── migrations/ # Append-only platform DB history
├── docs/ # Original research and specification documents
│   ├── original/ # Preserved originals
│   ├── processed/ # Sourced research and unaccepted proposals
│   │   └── artifacts/ # Non-sensitive documentation and review evidence, not runtime output
│   │       └── screenshots/ # Codex screen captures and visual review images
│   └── specification/ # Human-language HTML specifications
│       ├── info-*/ # Information specifications: terminology and maintained facts
│       ├── rule-*/ # Rule specifications: mandatory policies and engineering rules
│       └── design-*/ # Design specifications: accepted product and technical design
├── env/ # Local-only environment values and secrets, excluded from Git
│   └── local/ # Current local-server environment values
│       ├── dev/ # Development environment values
│       ├── stg/ # Staging environment values
│       └── prod/ # Production environment values
├── .codex/ # Codex project configuration and English AI specifications
│   ├── config.toml # Shareable Codex configuration without secrets
│   └── skills/ # Project skills and specifications
│       ├── info-*/ # Information specifications
│       ├── rule-*/ # Rule specifications
│       └── design-*/ # Design specifications
├── .github/ # GitHub collaboration and automation configuration
│   ├── workflows/ # CI/CD workflows
│   ├── ISSUE_TEMPLATE/ # Issue templates
│   └── pull_request_template.md # Pull request template
├── .vscode/ # Shareable VS Code development configuration
│   ├── settings.json # Project editor settings
│   ├── launch.json # Launch and debug configuration
│   ├── tasks.json # Development command integration
│   └── extensions.json # Recommended extensions
├── feedback/ # Human-owned ignored data no automatic management
├── uploads/ # Human-owned ignored data no automatic management
└── README.md # Repository guide
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
| `apps/jobs` | Asynchronous jobs, scheduler, batches, and periodic work |
| `packages/core` | Shared domain rules, application use cases, and ports |
| `packages/core/usage` | Metering definitions, configurable limits and capacity admission independent of billing |
| `packages/core/chat` | Human messaging and authorized history/change queries; no agent posting |
| `packages/adapters` | Database, storage, queue, secret, and external-service implementations; atomic counters and leases |
| `packages/contracts/schemas` | Authoritative language-neutral data contracts grouped by feature domain |
| `packages/contracts/py`, `packages/contracts/ts` | Generated language-specific contract code |
| `packages/design-system` | Shared visual foundations, assets, components, and UI language |
| `packages/workbench/sdk` | Customer-facing typed API and host communication; no host internals or secrets |
| `packages/workbench/build` | Fixed validation/typecheck/bundle/artifact toolchain inside isolation |
| `packages/workbench/runtime` | Host loading, trusted/isolated rendering, bridge and view lifecycle |
| `packages/workbench/editor` | Code editing, diagnostics, isolated preview and publication UI |

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

## Usage and resource-limit ownership

Accepted on 2026-09-15: operational usage controls precede BM implementation. core/usage owns
metric definitions, configurable system defaults, organization/workspace limits and admission
decisions. It must work without core/billing and must not import billing. Future billing can supply
plan-derived limit settings through the usage contract; no prices, invoices or automatic overage
charges are introduced by this structure.

- The API exposes authorized reads and configuration. The SaaS admin screen manages settings;
  organization/workspace scope does not itself grant members permission to change their limits.
  Changes are audited through the existing audit domain. MCP and jobs enforce the same policy.
- Metric candidates include concurrent connections, message rate/size, storage bytes, MCP query
  rate and concurrent builds/jobs. Separate current gauges, time-window counters and cumulative
  usage. Do not double-count retries or transport redelivery.
- PostgreSQL persists settings and usage history; Redis implements shared atomic counters and
  expiring capacity leases. The domain defines the required behavior, not a Redis-specific API.
  Plain read-then-increment is not sufficient admission control across processes.
- Capacity acquisition, renewal, release and expiry/reconciliation must cover disconnects and
  crashes. An expired lease must not silently authorize still-running work beyond the limit.
  Usage limits never replace authorization or execution isolation.
- deploy/local owns whole-server connection, memory and process safety ceilings. Tenant settings
  cannot bypass them. No root, service or deployment mechanism is added.
- Numeric defaults, window definitions, override precedence, lowering limits during active use,
  rejection/queuing/retry behavior and metering-store failure policy require per-file design.
  Reusing existing Redis does not authorize service changes. Full file/test mappings remain pending.

## Custom-code dependency and execution boundaries

- Customer code imports the public SDK and design-system, not apps, host runtime internals, core,
  adapters or the build tool. SDK consumes generated contracts; it never grants permissions.
- Runtime implements the host side of that protocol; bridge messages and server operations remain
  validated even when customer code bypasses the SDK. Client context is not authorization evidence.
- Editor composes runtime previews. Standard and custom views share UI/data contracts, not trust.
  The host owns the work list and outer layout; optional sidebar and panel coordinate bounded view
  state without sharing host DOM access. Panel tabs remain optional.
- workbench/build is an internal executable tool package, not another deployed service. apps/jobs
  remains the job entrypoint. The adapter invokes the build tool across an isolation boundary;
  its provider-specific setup belongs in deploy/local. Browser packages cannot depend on the build
  tool. Fixed build policy cannot be replaced by arbitrary customer scripts or plugins.
- Exact SDK exports, message schemas, artifact access controls, dependency policy, sandbox mechanism
  and per-file inputs/outputs/errors/test mappings still need reviewed records. This tree does not
  declare those implementation contracts complete or authorize executing tests now.

## Contracts and tests

`packages/contracts` is the data-contract domain. It owns language-neutral sources in `schemas/` and generated language code in `py/` and `ts/`. Schemas are grouped by feature domain. Root `contracts/` is no longer a target directory; existing sources must be mapped and preserved during later migration. Version actual coexisting contracts,
for example `packages/contracts/schemas/<subject>/v1/`; do not create empty version
scaffolding. Modify source schemas or generators, not generated outputs by hand.

All test code and test-only helpers belong under root `tests/`. Classify by
tested owner first: `api`, `web`, `mcp`, `jobs`, or `packages`. Add domain
groupings inside an owner only as needed. `tests/contracts` owns schema,
code-generation, language parity, and compatibility checks.
`tests/integration` owns checks spanning multiple apps; `tests/support` owns
shared fixtures and helpers. Package unit tests belong in `tests/packages`.
This supersedes the former domain-first tree and package-local test placement.

## Scripts and deployment

`scripts/` contains development, code-generation, and verification launchers.
Keep assertions in `tests/`, business logic in `packages/`, and recurring
business work in `apps/jobs`. Do not create a folder for one trivial script.

Deploy to the Human's local server now. The Human explicitly requested reserved
`deploy/local/dev/`, `stg/`, and `prod/` environment configuration directories.
Keep common procedures at local level and only environment-specific differences
under each environment. This planned structure does not deploy or start three
environments and never permits committed secrets. `deploy/local` owns server configuration
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
`docs/processed/artifacts/screenshots/` owns Codex-generated documentation and
visual-review captures. Keep only non-sensitive evidence, with provenance and
review subject linked from a Processed document. Do not capture secrets, personal
data or Human uploads. This location is not for automated test output, builds or
runtime logs; it is separate from product artifacts and design-system source assets.
Historical diagrams do not authorize restoring the old architecture.
Under `docs/specification/`, `info-*/` owns maintained facts and terminology,
`rule-*/` owns mandatory policies and engineering rules, and `design-*/` owns
accepted product and technical design. These are name patterns, not literal
wildcard or intermediate category folders: use names such as
`rule-workbench-structure/`. Each Human-language HTML specification is paired
with the same identity's English AI Skill under `.codex/skills/`.

## Migration acceptance

Update imports, build/package mappings, resource paths, test discovery, commands,
CI, and maintained references together with a move. Preserve dirty work and data.
Verify affected behavior and packaging, and report pre-existing failures separately.
Recording this specification does not mean source or tests have been relocated.
