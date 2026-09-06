#!/usr/bin/env bash
# Disposable database only; no application database credentials or data are used.
set -euo pipefail
cd "$(dirname "$0")/.."
planning_container="af-planning-import-verify-$(date +%s)-$$"
cleanup() { docker rm -f "$planning_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$planning_container" -e POSTGRES_PASSWORD=disposable-planning -e POSTGRES_DB=planning_test -p 127.0.0.1::5432 pgvector/pgvector:pg16 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$planning_container" pg_isready -U postgres -d planning_test >/dev/null 2>&1; then break; fi
  sleep 1
done
planning_port=$(docker port "$planning_container" 5432/tcp | sed 's/.*://')
export AGENT_FACTORY_DATABASE_URL="postgresql+asyncpg://postgres:disposable-planning@127.0.0.1:${planning_port}/planning_test"
export PLANNING_TEST_DATABASE_URL="$AGENT_FACTORY_DATABASE_URL"
export AGENT_FACTORY_ENVIRONMENT=test
export AGENT_FACTORY_RATE_LIMIT_ENABLED=false
.venv/bin/python -m alembic -c config/alembic.ini upgrade head
.venv/bin/python -m alembic -c config/alembic.ini downgrade 0015
.venv/bin/python -m alembic -c config/alembic.ini upgrade head
docker exec -i "$planning_container" psql -U postgres -d planning_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE planning_verifier NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO planning_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO planning_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO planning_verifier;
SQL
.venv/bin/python -m pytest -q tests/test_planning.py tests/test_planning_import.py tests/test_planning_import_integration.py tests/test_planning_integration.py tests/test_mcp_server.py
