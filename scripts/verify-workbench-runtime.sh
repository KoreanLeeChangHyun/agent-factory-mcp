#!/usr/bin/env bash
set -euo pipefail

runtime_host=127.0.0.1
runtime_port="${WORKBENCH_PREVIEW_PORT:-$(node -e 'const net=require("node:net");const server=net.createServer();server.listen(0,"127.0.0.1",()=>{console.log(server.address().port);server.close()})')}"
runtime_log="$(mktemp -t agent-factory-workbench-preview.XXXXXX.log)"
runtime_pid=""

cleanup() {
  if [[ -n "$runtime_pid" ]]; then
    kill "$runtime_pid" 2>/dev/null || true
    wait "$runtime_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

pnpm --filter @agent-factory/workbench-runtime test
pnpm --filter @agent-factory/workbench-editor test
pnpm --filter @agent-factory/web build
pnpm --filter @agent-factory/workbench-runtime test
pnpm --filter @agent-factory/workbench-editor test
pnpm --filter @agent-factory/web exec vite preview --host "$runtime_host" --port "$runtime_port" >"$runtime_log" 2>&1 &
runtime_pid=$!
for _ in $(seq 1 50); do
  if curl --fail --silent "http://${runtime_host}:${runtime_port}/workbench" >/dev/null; then
    break
  fi
  if ! kill -0 "$runtime_pid" 2>/dev/null; then
    sed -n '1,200p' "$runtime_log"
    exit 1
  fi
  sleep 0.1
done
curl --fail --silent "http://${runtime_host}:${runtime_port}/workbench" >/dev/null
WORKBENCH_URL="http://${runtime_host}:${runtime_port}" \
  NODE_PATH="${WORKBENCH_PLAYWRIGHT_NODE_PATH:-assets/ui-kit/node_modules}" \
  node tests/browser/workbench-runtime-editor.cjs
