#!/usr/bin/env bash
# Verification-owned: uses only an explicit disposable PostgreSQL URL or a new disposable container.
set -euo pipefail
cd "$(dirname "$0")/.."
run_python() {
  if [[ -n "${THEME_VERIFY_PYTHON:-}" ]]; then "${THEME_VERIFY_PYTHON}" "$@"; else uv run python "$@"; fi
}
cleanup() {
  if [[ -n "${theme_web_pid:-}" ]]; then kill "$theme_web_pid" >/dev/null 2>&1 || true; fi
  if [[ -n "${theme_container:-}" ]]; then docker rm -f "$theme_container" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

if [[ -z "${AGENT_FACTORY_TEST_DATABASE_URL:-}" || -z "${AGENT_FACTORY_TEST_ADMIN_DATABASE_URL:-}" ]]; then
  if command -v pg_config >/dev/null && [[ -f "$(pg_config --sharedir)/extension/vector.control" ]]; then
    echo "Local PostgreSQL with pgvector is available; supply explicit disposable AGENT_FACTORY_TEST_* URLs."
    exit 2
  fi
  command -v docker >/dev/null || { echo "No compatible local PostgreSQL or Docker is available."; exit 2; }
  theme_container="af-theme-verify-$(date +%s)-$$"
  docker run -d --name "$theme_container" --label agent-factory.disposable=theme-profile -e POSTGRES_PASSWORD=theme-test -e POSTGRES_DB=theme_test -p 127.0.0.1::5432 pgvector/pgvector:pg16
  for _ in $(seq 1 60); do docker exec "$theme_container" pg_isready -U postgres -d theme_test && break; sleep 1; done
  theme_port="$(docker port "$theme_container" 5432/tcp | sed 's/.*://')"
  export AGENT_FACTORY_TEST_ADMIN_DATABASE_URL="postgresql+asyncpg://postgres:theme-test@127.0.0.1:${theme_port}/theme_test"
  export AGENT_FACTORY_DATABASE_URL="$AGENT_FACTORY_TEST_ADMIN_DATABASE_URL"
  run_python -m alembic -c config/alembic.ini upgrade head
  docker exec -i "$theme_container" psql -U postgres -d theme_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE theme_verifier LOGIN PASSWORD 'theme-verifier' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO theme_verifier;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO theme_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO theme_verifier;
SQL
  export AGENT_FACTORY_TEST_DATABASE_URL="postgresql+asyncpg://theme_verifier:theme-verifier@127.0.0.1:${theme_port}/theme_test"
else
  export AGENT_FACTORY_DATABASE_URL="$AGENT_FACTORY_TEST_ADMIN_DATABASE_URL"
  run_python -m alembic -c config/alembic.ini upgrade head
fi

run_python scripts/prepare_theme_verifier.py
run_python -m pytest -q packages/platform-adapters/tests/test_theme_validation.py apps/api/tests/test_appearance.py tests/integration/test_theme_profiles.py
pnpm --filter @agent-factory/design-system test
pnpm --filter @agent-factory/web test
pnpm --filter @agent-factory/web build
pnpm --filter @agent-factory/web exec vite preview --host 127.0.0.1 --port 4173 > /tmp/agent-factory-theme-web.log 2>&1 &
theme_web_pid=$!
for _ in $(seq 1 60); do curl --fail --silent http://127.0.0.1:4173/ >/dev/null && break; sleep 1; done
NODE_PATH="${THEME_PLAYWRIGHT_NODE_PATH:-assets/ui-kit/node_modules}" node tests/browser/theme-profile.cjs
