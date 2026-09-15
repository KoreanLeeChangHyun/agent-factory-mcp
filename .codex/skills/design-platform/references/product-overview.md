# Product Overview

Specification: `design-platform`, version `1`, semantic revision `5`.  
Recorded: `2026-09-14`; updated: `2026-09-15`.  
Human counterpart: [product-overview.html](../../../../docs/specification/design-platform/product-overview.html).

## Cloud agent control tower

<!-- clause-id: design-platform.overview.purpose -->
Agent Factory is a cloud control tower for AI agents. Humans must be able to understand AI work, issue direct instructions when needed, and allow autonomous work when appropriate. The product supports the Human's judgment and intervention; neither constant manual direction nor unconditional autonomy is the default product requirement.

## Workbench interface

<!-- clause-id: design-platform.overview.layout -->
UI/UX is central to understanding work and deciding whether to intervene. VS Code is the structural reference: work list, optional sidebar, and panel (called 작업 패널 in the Human's explanation). The sidebar is optional per work item; do not reserve empty sidebar space when it is absent. Panel tabs are also optional and independent of sidebar presence. Existing technical identifiers are not renamed by this decision.

## Standard and custom work

<!-- clause-id: design-platform.overview.work -->
Provide standard work and user-authored code-based custom work in the same control interface. VS Code's built-in Explorer and marketplace extensions illustrate the distinction; an actual marketplace, distribution policy or commercial extension ecosystem has not been specified. The platform provides shared UI assets and a public SDK and compiles and renders customer code. TypeScript/React is the structural planning baseline; exact versions, bundler, dependency policy and sandbox technology require detailed design. JSON describes registration and protocol contracts, not the only permitted UI authoring format. Arbitrary server-side customer functions are not implied.

The Human accepted separate workbench-sdk and workbench-build packages on 2026-09-15.
Runtime owns host loading, rendering and message validation; editor owns authoring and preview;
worker dispatches builds; adapters manage isolated execution; the build package runs inside that
boundary. Source and artifacts are runtime data, not customer-named repository directories.
Publication and workspace activation are separate. See the
[structure contract](../../rule-workbench-structure/references/target-structure.md) for ownership.
Full file records and security mechanisms remain incomplete; structure approval is not implementation approval.

## Standard work inventory

<!-- clause-id: design-platform.overview.standard -->
The ten standard work items are organization, workspace, schedule, agents, documents, connections, logs, tests, DB, and account. Their detailed behavior will be specified separately. The earlier Human requirement for SaaS-administrator-only administration is separate from these ten items and from organization administrator privileges. The meaning of DB work and tests work does not itself grant unrestricted database access or define an execution engine.

## Plans and organization access

<!-- clause-id: design-platform.overview.plans -->
Plans are Personal, Team and Enterprise. Personal is single-user, has no organization work item and no workspace invitation feature. One workspace is free; additional workspaces use a subscription priced by workspace count. Count tiers and prices are undecided; paying for additional Personal workspaces does not imply collaboration. Team introduces organizations: the organization owner can invite users, assign each user's access scope and grant organization administrator privileges. Exact scope granularity and delegated administrator powers are undecided. Enterprise's stated differentiator from Team is security; specific security features and differentiation await research. This does not imply that Personal or Team lack baseline security. Multi-organization membership, plan transitions, seat limits and Team/Enterprise pricing were not specified.

## Workspace MCP

<!-- clause-id: design-platform.overview.mcp -->
Each workspace provides MCP functionality as part of the control system. Detailed tool/resource inventory, endpoint shape, transport, credentials and authorization mapping require later design; workspace MCP does not by itself specify one process or one deployment per workspace.

## Organization permissions and external data

The Human clarified that Team means the Team-plan organization, not a nested team.
Organization owners compose sets of individual permissions and assign them to users.
Exact scope types, inheritance/merging, denial precedence and delegation remain undecided.
External database connectivity is required. SQL authoring mode, supported databases,
read/write scope, private-network access and platform-managed schema creation remain open.
The external data and SaaS comparison reports under docs/processed are research, not accepted
implementation requirements.

## Human chat, editing and operational limits

<!-- clause-id: design-platform.overview.collaboration -->
Chat is between Humans. Agents may read authorized chat history through MCP; agent chat
posting, always-connected subscriptions and automatically starting agents on new messages
are not included. Human real-time delivery and agent pull queries are separate concerns.
Channel scope, participation rules, message editing/deletion, read receipts, attachments and
retention remain unresolved. This requirement does not add an eleventh standard work item.
Optimistic save-conflict handling is a planning proposal; simultaneous shared-cursor editing
and a specific collaboration engine have not been approved.

<!-- clause-id: design-platform.overview.usage -->
Operational usage and resource limits must be adjustable before implementing BM.
core/usage is independent of billing; system defaults and organization/workspace settings
do not introduce pricing or automatic overage charging. Metering, atomic capacity enforcement,
lease recovery and whole-server safety ceilings have separate owners in the target structure.
Numeric defaults, override precedence and per-operation exceedance behavior require detailed design.

## Authority and next steps

<!-- clause-id: design-platform.overview.status -->
Source: the Human's product explanation in this conversation on 2026-09-14 and explicit request to record it. These product decisions guide the directory contract and file-level implementation specification; they do not claim implemented behavior or approve unprovided details. Research informs unresolved decisions but does not silently accept them. Complete the directory contract and per-file specifications, obtain Human review, then arrange stage-specific long-running solo work. No implementation, tests, deployment or unattended run is authorized by recording this overview.
