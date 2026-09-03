#!/bin/sh
set -eu

backup_root="${AGENT_FACTORY_BACKUP_ROOT:-.backup}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_root/$timestamp"
pg_dump --format=custom --file="$backup_root/$timestamp/postgres.dump" "$AGENT_FACTORY_DATABASE_DSN"
mc mirror --quiet "$AGENT_FACTORY_S3_ALIAS/$AGENT_FACTORY_S3_BUCKET" "$backup_root/$timestamp/objects"
printf '%s\n' "$timestamp" > "$backup_root/$timestamp/COMPLETED"
