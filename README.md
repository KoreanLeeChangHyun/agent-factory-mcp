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

## Documentation

Repository knowledge follows three authority stages:

- `docs/original/`: external source documents and unchanged evidence.
- `docs/processed/`: analysis, audits, proposals, implementation traces, and verification records.
- `docs/specification/`: Human-facing accepted decisions and maintained specifications.

Each Specification has a synchronized pair: a Human-facing HTML package under
`docs/specification/<category>-<name>/` and an AI-facing Project Skill under
`.codex/skills/<category>-<name>/`. Categories are `info-*` for maintained
information, `design-*` for integrated planning and technical design, and `rule-*`
for mandatory behavior. Promotion keeps provenance links and never turns dated
Processed evidence into a Specification implicitly. This is the repository's only
`README.md`; nested guidance uses a purpose-specific filename or a Skill.

## Development

```bash
uv sync --all-packages --extra dev
.venv/bin/python scripts/operations/run.py api --env dev
```

For the complete local service stack:

```bash
# Configure env/dev.env before starting.
uv sync --all-packages --extra dev
pnpm install
pnpm build
pnpm start:api --env dev
```

Configure PostgreSQL, Redis, and object storage endpoints in the environment.
The API and worker run directly; Docker and Make are no longer used.

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
[`migration.md`](.codex/skills/rule-platform/references/migration.md) for the cutoff procedure.

After applying migrations, create the first platform administrator without
placing a password in shell history:

```bash
uv run python -m api.auth.bootstrap --email owner@example.com --display-name "Owner"
```

## Environments

Environment files live in `env/`: `dev.env`, `stg.env`, and `prod.env`. Configure each file with separate endpoints and credentials. Actual `.env` files are ignored by Git. The existing production file was restored to `env/prod.env` without changing its values. Dev and staging credentials have not been provisioned.

Choose the environment explicitly:

```sh
pnpm start:api --env dev
pnpm start:worker --env stg
pnpm start:scheduler --env prod
```

The runner maps dev/stg/prod to the existing local/staging/production settings modes. It refuses a missing environment file and does not fall back to another environment. Shell environment variables override file values; the runner fixes the environment mode to the selected profile. These commands define process configuration and do not establish that the ongoing application migration is complete.
