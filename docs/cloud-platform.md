# Shared cloud platform integration

This code connects the completed Document, collection, and reporting services to
shared MCP/HTTP registration, authentication, durable workers, migrations and
packaging. It does not migrate existing data, deploy a service, restart a container,
retire local sources, or accept a real Specification pair. Work has not run tests,
validators, builds, migrations, servers or providers.

## Registration and authorization

The application installs Document and integration MCP tools alongside existing
planning/reporting tools and registers their mapped models and HTTP routes.
`integration_list` uses `ConnectionResponse`, excluding encrypted credentials and
key metadata. It does not use generic ORM serialization.

New workspace-enrollment credentials receive `document:write` only with
`document.manage`, and `integration:manage` only with `integration.manage`.
No stored token scope is upgraded. A newly requested generic API token containing
these write scopes must supply `organization_id` and `workspace_id`; issuance
reauthorizes those permissions and persists the token's Workspace binding.
Calls still enforce token scope, token binding and current active Workspace RBAC.
Cloud collection execution additionally requires current `document.manage`.

Only a successful authenticated `package_preview` endpoint with the exact
server-owned preview headers preserves its sandbox CSP and SAMEORIGIN framing.
Errors, member/download routes, and all other endpoints retain the ordinary CSP
and DENY framing. The exception does not trust URL suffixes or uploaded metadata.

## Worker authority, claims and recovery

The queue retains its old argument shape for transport compatibility. Its
organization/workspace/user values are ignored. An internal control-plane lookup
resolves durable Job ownership, and the domain handler receives a separately
reauthorized current User/Workspace context, never system authority or identity
from the payload. The handler accepts only its exact run ID and checks the Job
requester, tenant, task type, claim status, idempotency key and payload.

A dedicated PostgreSQL transaction advisory lock lives across Job/domain commits.
Duplicate deliveries cannot claim an active Job. Process/connection loss releases
the claim; a redelivery can then recover a RUNNING Job. Periodic retry dispatch
also republishes stale running/cancel-requested Jobs after the configured worker
time limit. This is recovery dispatch, not a time-based permission to steal a
live claim. The existing max-attempt bound still applies.

Fresh probes read the exact Job and reauthorize current permissions before
provider requests and source writes. Connection guards serialize cloud token
operations, collection commits and legacy disconnect/cursor changes. Cancellation
locks the Job row; cancellation before claim performs no provider I/O. Exceptions
retain concurrent cancellation. Retry-After is retained as a lower bound alongside
normal backoff; terminal failures reconcile the exact collection run and retain
its last checkpoint and already persisted Originals. Source cursors still advance
only after durable Document revisions and mappings. Reserve at least four pooled
connections per active collection worker plus request/control-plane headroom.

There is no distributed DB/object-store transaction. An object may remain after a
failed or ambiguously acknowledged commit. Do not delete staging objects merely
because a receipt was not observed. Replay exact upload metadata/key and inspect
durable revisions before any operator-led retention action.

## OAuth and deployment secrets

The existing environment-backed Settings authority now exposes the five provider
OAuth client IDs, SecretStr client secrets, redirect URIs and Microsoft tenant via
the documented `AF_<PROVIDER>_OAUTH_*` aliases. Values are not invented. Configure
all three client fields together. Redirect URIs must exactly equal
`<public_base_url>/api/integrations/oauth/<provider>/callback`, including any
configured application prefix. HTTPS remains required by the provider contract.

The callback authenticates the current browser session, finds only that user's
unexpired state, resolves its original Workspace, reauthorizes integration.manage,
and exchanges through the actual provider adapter. Denial consumes state without
exchange. Expiry/replay fails closed. The result redirects to a clean first-party
Workspace URL with no-store/no-referrer; no provider error, code or query token is
reflected. Uvicorn access logs strip queries. Caddy skips this callback's access
log, and httpx/httpcore request logging is suppressed. Independently operated
upstream proxies must use the same query/token privacy controls before rollout.

`AGENT_FACTORY_ENV_FILE` optionally selects the dotenv source; an empty value
disables dotenv entirely. The disposable harness uses this along with an explicit
newly allocated loopback database URL. Ordinary deployments retain `.env` default.

## Wheel and image

PyYAML is declared directly. Setuptools includes the preview runtime and packaged
MCP guides. Its build hook copies maintained `static`, `template`, `config`, and
`docs` resources into the wheel without trimming vendor assets. The image builder
supplies these same roots. Installed wheels resolve browser assets from their
packaged fallback when checkout-level assets are absent. Reporting/planning guides
read package resources; integration/cloud-reporting guides remain synchronized
Python constants. Update the maintained Markdown and its package copy/constant
together. Cloud reporting is a recipient and never calls `agent_run_submit` or
`AgentService.create_run`; optional runtime bindings/heartbeats do not execute AI.

## Independent Verification commands

Prerequisites: the project's Python environment with dev dependencies, Docker,
Node, and an installed Playwright Chromium runtime. No live provider accounts or
credentials are needed. Run only this focused harness:

```sh
NODE_PATH=/tmp/af-pw/node_modules bash scripts/verify-cloud-platform.sh
```

The harness creates one uniquely named pgvector PostgreSQL container without a
host volume, binds only a random loopback port, applies migrations through 0017,
upgrades through 0021, downgrades the empty disposable DB to 0017 and re-upgrades,
then grants a non-owner NOSUPERUSER/NOBYPASSRLS role for actual application calls.
It prints a transcript path under `/tmp`. Cleanup targets only its own generated
container. It never calls compose, current dev/production containers, `.env` DB,
public providers, or the unrelated full suite. Work authored but did not execute
this command; there are no execution results to report.

The new integration tests run an actual Uvicorn HTTP/MCP server, an isolated
filesystem object-storage adapter, and actual provider adapters with HTTP fixtures.
They cover no-token/expired/revoked/cross-Workspace denial, issuance/call-time write
permissions, exact/concurrent imports, RLS, lexical Korean/identifier lookup,
synthetic pair rejection preserving publication, complete Git-managed Document and
Agent source-package bytes, large binary upload digest/expiry/retry, authenticated
preview headers, worker acceptance vs execution, pending and in-loop cancellation,
concurrent claims/connection mutations, recovery from persisted RUNNING state,
Retry-After/exhaustion, cursor behavior on failed object writes, OAuth exchange/
denial/expiry, optional reporting binding and heartbeat persistence, and the actual
current editor opening/closing/reopening a durable Document. The wheel test builds
in a disposable copy and compares all packaged browser/resource bytes.

This new current-editor case must succeed before claiming integrated editor
coverage. The earlier broader `document-editor.cjs` timeout remains historical
incomplete evidence and is not reclassified as a pass. The recovery test starts
from a durably written orphan RUNNING record; it does not simulate killing a live
OS worker. Provider fixtures do not establish deployed egress or live account
permissions. The isolated storage adapter does not establish a production S3
service's failure guarantees. Verification must report these limits and actual
commands/results, including failures, independently.

## Migration and cutover limits

The code chain is linear: `0017 -> 0018 -> 0019 -> 0020 -> 0021`. Changing 0020's
parent assumes these independent migration heads have not been deployed. If a
real database already has 0020 stamped without 0018/0019, stop and inspect its
physical schema and recorded revisions; do not blindly stamp, downgrade, or reuse
the fresh-DB procedure. Any reconciliation requires a separately reviewed plan.

Schema registration does not import historical Documents or credentials, reconcile
Specification semantics, replay local reporting outboxes, install a local runtime
adapter, cut over source authority, or delete Originals. Actual Git-managed pair
packages may satisfy byte limits without satisfying coverage/review requirements.
Tests label synthetic review records as fixtures; they cannot accept project
knowledge. Keep source inventories and both real representations intact. Human
acceptance, production secret provisioning, legacy-head reconciliation if needed,
retention policy and live cutover remain with their owning decisions/work.


Source inventory taken during this Work (read-only, not an import test): Git-managed
Document roots contain 27 files / 8,159,332 bytes; Git-managed Agent roots contain
19 files / 4,315,663 bytes. The current Agent source additionally has untracked
`skills/agent/references/reporting.md` (4,795 bytes) and
`skills/agent/runtime/cloud_reporting.py` (21,490 bytes). The package fixture uses
both tracked and nonignored untracked source files and preserves those additions;
it does not include ignored generated `__pycache__` files as distributable sources.
These measurements differ from the earlier handoff's full-directory totals and do
not imply missing vendor assets or Specification acceptance. Per-file hashes and
Git-managed flags are recorded in this run's `source-inventory.json`.
