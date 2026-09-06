#!/usr/bin/env bash
# Verification-owned execution. No existing DB/container, volume, credentials or .env DB.
# Requires access to Docker, Playwright Chromium, and setuptools>=75 for wheel builds.
# CLOUD_VERIFY_PYTHON may select an isolated build-capable venv; do not alter the repo venv.
# If Docker is unavailable, independent Verification may provision private rootless
# PG16+pgvector and run these same focused commands with explicit disposable URLs.
# Prior fallback procedure/evidence: cloud-platform-verify-20260906 /
# run-20260905T173327247843Z-413b699f/evidence/start.py (not a production recipe).
set -euo pipefail
cd "$(dirname "$0")/.."
cloud_python="${CLOUD_VERIFY_PYTHON:-.venv/bin/python}"
cloud_container="af-cloud-platform-verify-$(date +%s)-$$"
cloud_log="${CLOUD_VERIFY_LOG:-/tmp/${cloud_container}.log}"
exec > >(tee "$cloud_log") 2>&1
cleanup() { docker rm -f "$cloud_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --name "$cloud_container" --label agent-factory.disposable=cloud-platform \
  -e POSTGRES_PASSWORD=disposable-cloud -e POSTGRES_DB=cloud_platform_test \
  -p 127.0.0.1::5432 "${CLOUD_POSTGRES_IMAGE:-pgvector/pgvector:pg16}"
for attempt in $(seq 1 60); do
  if docker exec "$cloud_container" pg_isready -U postgres -d cloud_platform_test; then break; fi
  sleep 1
done
docker exec "$cloud_container" pg_isready -U postgres -d cloud_platform_test
cloud_port=$(docker port "$cloud_container" 5432/tcp | sed 's/.*://')
export CLOUD_TEST_ADMIN_DATABASE_URL="postgresql+asyncpg://postgres:disposable-cloud@127.0.0.1:${cloud_port}/cloud_platform_test"
export AGENT_FACTORY_DATABASE_URL="$CLOUD_TEST_ADMIN_DATABASE_URL"
export AGENT_FACTORY_ENV_FILE=''
export AGENT_FACTORY_ENVIRONMENT=test AGENT_FACTORY_RATE_LIMIT_ENABLED=false
export AGENT_FACTORY_ROOT_PATH='' AGENT_FACTORY_PUBLIC_BASE_URL=http://127.0.0.1:8000
export AGENT_FACTORY_TRUSTED_HOSTS='["127.0.0.1","localhost","testserver"]'
export AGENT_FACTORY_EMBEDDING_PROVIDER=disabled
# Empty disposable DB only. Never downgrade a database containing collected evidence.
"$cloud_python" -m alembic -c config/alembic.ini upgrade 0017
"$cloud_python" -m alembic -c config/alembic.ini upgrade head
"$cloud_python" -m alembic -c config/alembic.ini downgrade 0017
"$cloud_python" -m alembic -c config/alembic.ini upgrade head
docker exec -i "$cloud_container" psql -U postgres -d cloud_platform_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE cloud_verifier LOGIN PASSWORD 'disposable-verifier' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO cloud_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloud_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloud_verifier;
SQL
export CLOUD_TEST_DATABASE_URL="postgresql+asyncpg://cloud_verifier:disposable-verifier@127.0.0.1:${cloud_port}/cloud_platform_test"
export AGENT_FACTORY_DATABASE_URL="$CLOUD_TEST_DATABASE_URL"
"$cloud_python" -m pytest -q tests/test_cloud_platform_integration.py tests/test_cloud_platform_packaging.py
# Shared registration/auth/transition regressions affected by platform integration.
"$cloud_python" -m pytest -q tests/test_authentication.py tests/test_authorization.py \
  tests/test_mcp_server.py tests/test_scheduling.py
# Existing focused domain regressions; no unrelated full suite.
"$cloud_python" -m pytest -q tests/test_cloud_documents.py tests/test_cloud_document_delivery.py \
  tests/test_cloud_document_delivery_http.py tests/test_cloud_integrations_providers.py \
  tests/test_cloud_integrations_collections.py tests/test_cloud_integrations_packaging.py \
  tests/test_cloud_reporting.py tests/test_reporting.py tests/test_integrations.py
printf 'Verification transcript: %s\n' "$cloud_log"
