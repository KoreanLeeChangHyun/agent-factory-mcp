.PHONY: dev-up dev-down dev-logs db-upgrade db-downgrade admin-bootstrap lint typecheck test security check workbench-format workbench-lint workbench-typecheck workbench-test workbench-codegen-check workbench-contracts workbench-dependencies workbench-build workbench-check verify-theme-profiles verify-workbench-runtime

dev-up:
	docker compose --env-file .env -f deploy/compose.yaml up --build -d

dev-down:
	docker compose --env-file .env -f deploy/compose.yaml down

dev-logs:
	docker compose --env-file .env -f deploy/compose.yaml logs -f api worker scheduler

db-upgrade:
	.venv/bin/alembic -c config/alembic.ini upgrade head

db-downgrade:
	.venv/bin/alembic -c config/alembic.ini downgrade -1

admin-bootstrap:
	.venv/bin/python -m app.modules.auth.bootstrap --email "$(EMAIL)" --display-name "$(NAME)"

lint:
	.venv/bin/ruff format --check app tests
	.venv/bin/ruff check app tests

typecheck:
	.venv/bin/mypy app

test:
	.venv/bin/python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=60 -q

security:
	.venv/bin/bandit -q -r app -x app/db/migrations
	.venv/bin/pip-audit

workbench-format:
	pnpm format
	uv run ruff format --check --exclude "**/generated/**" apps/api apps/worker packages/contracts-py packages/platform-core packages/platform-adapters tests/contracts tests/architecture scripts/check_workbench_contract_parity.py scripts/check_workbench_schema_compatibility.py scripts/check_workbench_dependencies.py scripts/generate_workbench_contracts.py

workbench-lint:
	pnpm lint
	uv run ruff check --exclude "**/generated/**" apps/api apps/worker packages/contracts-py packages/platform-core packages/platform-adapters tests/contracts tests/architecture scripts/check_workbench_contract_parity.py scripts/check_workbench_schema_compatibility.py scripts/check_workbench_dependencies.py scripts/generate_workbench_contracts.py

workbench-typecheck:
	pnpm typecheck
	uv run mypy packages/contracts-py/src packages/platform-core/src packages/platform-adapters/src apps/api/src apps/worker/src tests/contracts/type_contracts.py

workbench-test:
	pnpm test
	uv run pytest -q tests/contracts tests/architecture apps/api/tests apps/worker/tests

workbench-codegen-check:
	python3 scripts/generate_workbench_contracts.py --check

workbench-contracts:
	uv run python scripts/check_workbench_contract_parity.py
	python3 scripts/check_workbench_schema_compatibility.py

workbench-dependencies:
	python3 scripts/check_workbench_dependencies.py

workbench-build:
	pnpm build
	uv build --all-packages

verify-theme-profiles:
	bash scripts/verify-theme-profiles.sh

verify-workbench-runtime:
	bash scripts/verify-workbench-runtime.sh

workbench-check: workbench-format workbench-lint workbench-typecheck workbench-codegen-check workbench-contracts workbench-dependencies workbench-test

check: lint typecheck test workbench-check
