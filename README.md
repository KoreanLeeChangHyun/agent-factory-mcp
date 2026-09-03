# Agent Factory MCP

FastAPI application hosting the Agent Factory MCP server and Workspace UI.

The service is designed as a multi-tenant SaaS from the start. PostgreSQL is
the authoritative database, with pgvector used for document embeddings and
semantic retrieval. Project repositories do not receive an `.agent-factory/`
runtime directory.

## Service boundaries

- `/workspace/`: tenant Workspace UI
- `/admin/`: platform administration UI
- `/api/`: tenant API
- `/api/admin/`: platform administration API
- `/mcp`: authenticated MCP transport

Workspace scopes Documents, Agents, schedules, integrations, logs, and tests to
an organization and workspace. Local files under `uploads/`, `feedback/`,
`exports/`, and `.backup/` are development-only adapters and are ignored by
Git; production deployments use managed database and object-storage services.

## Development

```bash
python -m venv .venv
.venv/bin/pip install '.[dev]'
.venv/bin/uvicorn app.main:app --reload
```

The HTTP health check is available at `/health`, and Streamable HTTP MCP is
mounted at `/mcp`.
