#!/usr/bin/env bash
# Independent Verification only: build the supported runtime artifact, never deploy it.
set -euo pipefail
cd "$(dirname "$0")/.."
reporting_runtime_image="af-reporting-runtime-verify:$(date +%s)-$$"
reporting_python="${REPORTING_PYTHON:-.venv/bin/python}"
cleanup() { docker image rm "$reporting_runtime_image" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker build --target runtime --tag "$reporting_runtime_image" .
REPORTING_RUNTIME_IMAGE="$reporting_runtime_image" "$reporting_python" -m pytest -q tests/test_reporting_runtime.py
