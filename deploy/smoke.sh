#!/bin/sh
set -eu

base_url="${1:?usage: deploy/smoke.sh https://agent-factory.example.com}"
curl --fail --silent --show-error "$base_url/live" | grep -q '"alive"'
curl --fail --silent --show-error "$base_url/ready" | grep -q '"ready"'
curl --fail --silent --show-error "$base_url/workspace/" | grep -q 'Agent Factory'
status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/api/admin/dashboard")"
test "$status" = "401"
printf 'smoke checks passed for %s\n' "$base_url"
