#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mcp_container="af-mcp-handoff-verify-$(date +%s)-$$"
trap 'docker rm -f "$mcp_container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$mcp_container" -e POSTGRES_PASSWORD=disposable-mcp -e POSTGRES_DB=mcp_test -p 127.0.0.1::5432 pgvector/pgvector:pg16 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$mcp_container" pg_isready -U postgres -d mcp_test >/dev/null 2>&1; then break; fi
  sleep 1
done
mcp_port=$(docker port "$mcp_container" 5432/tcp | sed 's/.*://')
export AGENT_FACTORY_DATABASE_URL="postgresql+asyncpg://postgres:disposable-mcp@127.0.0.1:${mcp_port}/mcp_test"
export AGENT_FACTORY_ENVIRONMENT=test
export AGENT_FACTORY_RATE_LIMIT_ENABLED=false
.venv/bin/python -m alembic -c config/alembic.ini upgrade head
.venv/bin/python -m alembic -c config/alembic.ini downgrade 0016
.venv/bin/python -m alembic -c config/alembic.ini upgrade head
docker exec -i "$mcp_container" psql -U postgres -d mcp_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE mcp_verifier LOGIN PASSWORD 'disposable-verifier' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO mcp_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mcp_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mcp_verifier;
SQL
export MCP_TEST_DATABASE_URL="postgresql+asyncpg://mcp_verifier:disposable-verifier@127.0.0.1:${mcp_port}/mcp_test"
.venv/bin/python -m pytest -q tests/test_mcp_connections_integration.py
