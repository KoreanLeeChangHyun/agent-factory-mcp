#!/usr/bin/env bash
# Independent Verification only. Creates a disposable PostgreSQL container, never uses .env DB.
set -euo pipefail
cd "$(dirname "$0")/.."
reporting_container="af-reporting-verify-$(date +%s)-$$"
reporting_image="${REPORTING_POSTGRES_IMAGE:-pgvector/pgvector:pg16}"
reporting_python="${REPORTING_PYTHON:-.venv/bin/python}"
cleanup() { docker rm -f "$reporting_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# No mounted host data and a randomly assigned loopback port.
docker run --detach --name "$reporting_container" -e POSTGRES_PASSWORD=disposable-reporting -e POSTGRES_DB=reporting_test -p 127.0.0.1::5432 "$reporting_image" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$reporting_container" pg_isready -U postgres -d reporting_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$reporting_container" pg_isready -U postgres -d reporting_test >/dev/null
reporting_port=$(docker port "$reporting_container" 5432/tcp | sed 's/.*://')
export AGENT_FACTORY_DATABASE_URL="postgresql+asyncpg://postgres:disposable-reporting@127.0.0.1:${reporting_port}/reporting_test"
export AGENT_FACTORY_ENVIRONMENT=test
export AGENT_FACTORY_RATE_LIMIT_ENABLED=false
export REPORTING_TEST_ADMIN_DATABASE_URL="$AGENT_FACTORY_DATABASE_URL"
"$reporting_python" -m alembic -c config/alembic.ini upgrade 0014
"$reporting_python" -m alembic -c config/alembic.ini upgrade 0015
"$reporting_python" -m alembic -c config/alembic.ini downgrade 0014
"$reporting_python" -m alembic -c config/alembic.ini upgrade 0015
docker exec -i "$reporting_container" psql -U postgres -d reporting_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE reporting_verifier LOGIN PASSWORD 'disposable-verifier' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO reporting_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO reporting_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO reporting_verifier;
SQL
export REPORTING_TEST_DATABASE_URL="postgresql+asyncpg://reporting_verifier:disposable-verifier@127.0.0.1:${reporting_port}/reporting_test"
"$reporting_python" -m pytest -q tests/test_reporting.py tests/test_reporting_integration.py tests/test_mcp_server.py
"$reporting_python" -m pytest -q tests/browser/reporting.py

bash scripts/verify-reporting-runtime.sh
