#!/usr/bin/env bash
# Run only against a new disposable PostgreSQL instance.
set -euo pipefail
cd "$(dirname "$0")/.."
organization_container="af-organizations-verify-$(date +%s)-$$"
trap 'docker rm -f "$organization_container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$organization_container" --label agent-factory.disposable=organizations -e POSTGRES_PASSWORD=disposable-organizations -e POSTGRES_DB=organization_test -p 127.0.0.1::5432 pgvector/pgvector:pg16 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$organization_container" pg_isready -U postgres -d organization_test >/dev/null 2>&1; then break; fi
  sleep 1
done
organization_port=$(docker port "$organization_container" 5432/tcp | sed 's/.*://')
export AGENT_FACTORY_DATABASE_URL="postgresql+asyncpg://postgres:disposable-organizations@127.0.0.1:${organization_port}/organization_test"
export ORGANIZATION_TEST_DATABASE_URL="$AGENT_FACTORY_DATABASE_URL"
export AGENT_FACTORY_ENVIRONMENT=test
export AGENT_FACTORY_RATE_LIMIT_ENABLED=false
.venv/bin/python -m alembic -c config/alembic.ini upgrade head
.venv/bin/python -m alembic -c config/alembic.ini downgrade 0021
.venv/bin/python -m alembic -c config/alembic.ini upgrade head
docker exec -i "$organization_container" psql -U postgres -d organization_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE organization_verifier NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO organization_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO organization_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO organization_verifier;
SQL
.venv/bin/python -m pytest -q tests/test_organization_management.py tests/test_authorization.py
