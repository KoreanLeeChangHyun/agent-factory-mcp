#!/usr/bin/env bash
# Verification-owned Stage 10 production/forced-RLS/browser gate. Uses no Docker or developer database.
set -euo pipefail
cd "$(dirname "$0")/../.."
stage10_python="${STAGE10_VERIFY_PYTHON:-/tmp/organization-build-env/bin/python}"
stage10_pg="${AF_PG_PREFIX:?AF_PG_PREFIX must point to the private PostgreSQL16/pgvector distribution}"
if [[ -x "$stage10_pg/root/usr/lib/postgresql/16/bin/initdb" ]]; then
  stage10_pg_bin="$stage10_pg/root/usr/lib/postgresql/16/bin"
elif [[ -x "$stage10_pg/bin/initdb" ]]; then
  stage10_pg_bin="$stage10_pg/bin"
else
  printf 'PostgreSQL 16 executables were not found under AF_PG_PREFIX: %s\n' "$stage10_pg" >&2
  exit 1
fi
for stage10_pg_command in initdb pg_ctl pg_isready createdb psql; do
  [[ -x "$stage10_pg_bin/$stage10_pg_command" ]] || {
    printf 'Required PostgreSQL executable is unavailable: %s\n' "$stage10_pg_bin/$stage10_pg_command" >&2
    exit 1
  }
done
stage10_root="$(mktemp -d /tmp/af-stage10-native.XXXXXX)"
stage10_data="$stage10_root/data"
stage10_socket="$stage10_root/socket"
stage10_log="$stage10_root/postgres.log"
mkdir -p "$stage10_socket"
stage10_port="$($stage10_python -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
cleanup() {
  "$stage10_pg_bin/pg_ctl" -D "$stage10_data" -m fast stop >/dev/null 2>&1 || true
  rm -rf -- "$stage10_root"
}
trap cleanup EXIT
"$stage10_pg_bin/initdb" -D "$stage10_data" -U postgres --auth-local=trust --auth-host=trust >/dev/null
"$stage10_pg_bin/pg_ctl" -D "$stage10_data" -l "$stage10_log" -o "-h 127.0.0.1 -p $stage10_port -k $stage10_socket" start >/dev/null
"$stage10_pg_bin/pg_isready" -h 127.0.0.1 -p "$stage10_port" -U postgres
"$stage10_pg_bin/createdb" -h 127.0.0.1 -p "$stage10_port" -U postgres cloud_platform_test
export CLOUD_TEST_ADMIN_DATABASE_URL="postgresql+asyncpg://postgres@127.0.0.1:${stage10_port}/cloud_platform_test"
export AGENT_FACTORY_DATABASE_URL="$CLOUD_TEST_ADMIN_DATABASE_URL"
export AGENT_FACTORY_ENV_FILE=''
export AGENT_FACTORY_ENVIRONMENT=test AGENT_FACTORY_RATE_LIMIT_ENABLED=false
export AGENT_FACTORY_ROOT_PATH='' AGENT_FACTORY_PUBLIC_BASE_URL="http://127.0.0.1:${stage10_port}"
export AGENT_FACTORY_TRUSTED_HOSTS='["127.0.0.1","localhost","testserver"]'
export AGENT_FACTORY_EMBEDDING_PROVIDER=disabled
"$stage10_python" -m alembic -c config/alembic.ini upgrade head
"$stage10_pg_bin/psql" -h 127.0.0.1 -p "$stage10_port" -U postgres -d cloud_platform_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE cloud_verifier LOGIN PASSWORD 'disposable-verifier' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO cloud_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloud_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloud_verifier;
SQL
export CLOUD_TEST_DATABASE_URL="postgresql+asyncpg://cloud_verifier:disposable-verifier@127.0.0.1:${stage10_port}/cloud_platform_test"
export AGENT_FACTORY_DATABASE_URL="$CLOUD_TEST_DATABASE_URL"
export CLOUD_TEST_DATABASE_URL AGENT_FACTORY_DATABASE_URL
export NODE_PATH="${WORKBENCH_PLAYWRIGHT_NODE_PATH:-/tmp/af-pw/node_modules}"
pnpm --filter @agent-factory/web build
"$stage10_python" -m pytest -q tests/platform/integration/test_cloud_platform_integration.py::test_stage10_production_native_management_browser
node tests/identity/browser/auth-assets.cjs
printf 'Visual artifacts: /tmp/af-native-stage10-1440.png and /tmp/af-native-stage10-390.png\n'
