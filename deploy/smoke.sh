#!/bin/sh
set -eu

base_url="${1:?usage: deploy/smoke.sh https://example.com/factory}"
root_url="${base_url%/}"
curl --fail --silent --show-error --location "$root_url" | grep -F 'Agent Factory' >/dev/null
curl --fail --silent --show-error "$base_url/live" | grep -F '"alive"' >/dev/null
curl --fail --silent --show-error "$base_url/ready" | grep -F '"ready"' >/dev/null
curl --fail --silent --show-error "$base_url/login/" | grep -F 'Workspace 로그인' >/dev/null
workspace_location="$(curl --silent --output /dev/null --write-out '%{redirect_url}' "$base_url/workspace/")"
test "$workspace_location" = "${root_url}/login/"
curl --fail --silent --show-error "$base_url/static/css/workspace.css" | grep -F 'color-scheme' >/dev/null
curl --fail --silent --show-error "$base_url/static/js/workspace.js" | grep -F 'rootPath' >/dev/null
curl --fail --silent --show-error "$base_url/static/css/login.css" | grep -F 'color-scheme' >/dev/null
curl --fail --silent --show-error "$base_url/static/js/login.js" | grep -F 'rootPath' >/dev/null
status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/api/admin/dashboard")"
test "$status" = "401"
printf 'smoke checks passed for %s\n' "$base_url"
