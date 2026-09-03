.PHONY: dev-up dev-down dev-logs db-upgrade db-downgrade admin-bootstrap lint typecheck test security check

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
	.venv/bin/python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=50 -q

security:
	.venv/bin/bandit -q -r app -x app/db/migrations,app/infrastructure/workspace/runtime.py
	.venv/bin/pip-audit

check: lint typecheck test
