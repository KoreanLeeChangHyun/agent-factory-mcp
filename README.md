# Agent Factory MCP

FastAPI application hosting the Agent Factory MCP server and Workspace UI.

Agent Factory is a Human-facing control and visibility plane for AI activity,
not an AI harness or runtime. It does not reduce an Agent's native model, memory,
skills, tools, delegation, or execution capabilities. It collects the reports
and evidence available from connected Agents and presents their actions,
relationships, effects, state, and results so that Humans can understand and
intervene. A reported action is not treated as independently proven execution
without corresponding evidence.

The service is designed as a multi-tenant SaaS from the start. PostgreSQL is
the authoritative database, with pgvector used for document embeddings and
semantic retrieval. Project repositories do not receive an `.agent-factory/`
runtime directory.

## Service boundaries

Production is published below `/factory`; for example, the Workspace is
`https://example.com/factory/workspace/`. Caddy removes the public prefix before
proxying while FastAPI's configured root path keeps generated URLs, redirects,
cookies, and browser requests aligned.

- `/factory/workspace/`: tenant Workspace UI
- `/factory/login/`: browser sign-in; unauthenticated Workspace requests redirect here
- `/factory/admin/`: platform administration UI
- `/factory/api/`: tenant API
- `/factory/api/admin/`: platform administration API
- `/factory/mcp`: authenticated MCP transport

Local development keeps `AGENT_FACTORY_ROOT_PATH` empty and uses the same routes
without `/factory`.

Workspace scopes Documents, Agents, schedules, integrations, logs, and tests to
an organization and workspace. Local files under `uploads/`, `feedback/`,
`exports/`, and `.backup/` are development-only adapters and are ignored by
Git; production deployments use managed database and object-storage services.

The service owns Workspace runtime behavior and Document persistence. The
Agent Factory plugin keeps only its distributable Skill contracts; consumer
projects do not receive a Workspace server, copied browser bundle, or
project-local `.agent-factory/workspace` tree. Client installation state may
live under the user's `~/.agent-factory/` home directory, but it is never an
authoritative Document store.

## Development

```bash
python -m venv .venv
.venv/bin/pip install '.[dev]'
.venv/bin/uvicorn app.main:app --reload
```

For the complete local service stack:

```bash
cp .env.example .env
make dev-up
```

The development stack binds the API, MinIO console, and Mailpit UI to loopback.
PostgreSQL, Redis, and the MinIO API remain on the internal Compose network.

The local HTTP health check is available at `/health`, and Streamable HTTP MCP
is mounted at `/mcp`. In production these are `/factory/health` and
`/factory/mcp`. Set `AGENT_FACTORY_PUBLIC_BASE_URL` to the complete public base,
such as `https://example.com/factory`.

## Legacy Document migration

Inventory a former project-local Document tree without changing it:

```bash
.venv/bin/python -m app.modules.document.legacy_import \
  --source /path/to/project \
  --manifest .backup/legacy-documents.json
```

Review and retain that content-addressed manifest, back up the source tree,
then repeat with `--apply` and the destination organization, workspace, and an
existing revision-author user ID. The importer creates deterministic archives
for multi-file packages, verifies uploaded hashes, stops on conflicting slugs,
and can resume matching imports. It never deletes or rewrites the source. See
[`migration.md`](.codex/skills/spec-platform/references/migration.md) for the cutoff procedure.

After applying migrations, create the first platform administrator without
placing a password in shell history:

```bash
make admin-bootstrap EMAIL=owner@example.com NAME="Owner"
```
