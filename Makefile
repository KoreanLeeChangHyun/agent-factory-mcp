.PHONY: dev-up dev-down dev-logs lint test check

dev-up:
	docker compose --env-file .env -f deploy/compose.yaml up --build -d

dev-down:
	docker compose --env-file .env -f deploy/compose.yaml down

dev-logs:
	docker compose --env-file .env -f deploy/compose.yaml logs -f api worker scheduler

lint:
	.venv/bin/ruff check app tests

test:
	.venv/bin/python -m pytest -q

check: lint test
