#!/bin/sh
set -eu

export AGENT_FACTORY_ENV_FILE=../.env.production
compose="docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.production.yaml"
$compose build api worker scheduler migrate
$compose --profile release run --rm migrate
$compose up -d --no-deps --scale api=1 api
$compose up -d --no-deps --scale worker=3 worker scheduler
$compose ps
