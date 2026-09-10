---
name: rule-project
description: Apply this repository's project structure, ownership, development, testing, and documentation conventions. Use when implementing, refactoring, reviewing, or placing files in the Agent Factory MCP repository; do not use as the source of product behavior or domain contracts.
---

# Project Rules

Keep changes consistent with this FastAPI MCP/Workspace application and its existing ownership boundaries.

## Start with the affected area

1. Read [references/directory-structure.md](references/directory-structure.md) before adding, moving, or substantially reorganizing files.
2. Inspect the owning module, its callers, nearby tests, and established patterns before editing.
3. For product behavior, permissions, persistence, or API semantics, use `$spec-platform` and read only the relevant specification documents.
4. For Human-facing Workspace UI work, also use `$rule-ui`; its visual rules supplement this project Skill.

## Engineering conventions

- Keep routers thin. Put domain rules in `app/modules/<domain>/`, shared infrastructure in `app/infrastructure/`, and cross-cutting configuration or security in `app/core/`.
- Preserve organization and Workspace isolation across routes, services, repositories, jobs, MCP tools, and tests. UI visibility is never an authorization boundary.
- Reuse existing abstractions and make the smallest coherent change. Do not mix broad formatting or unrelated cleanup into behavioral work.
- Keep public API, MCP tool, database migration, static asset, and packaging changes synchronized with their owning tests and documentation.
- Add Alembic revisions instead of rewriting migration history. Treat PostgreSQL as authoritative; development adapters are not production architecture.
- Put shared browser primitives and tokens in `static/css/ui.css` or `static/ui/`; keep feature-specific behavior in its existing template, CSS, and JavaScript surface.
- Explain non-obvious constraints and side effects in comments; do not narrate straightforward code. Every TODO needs a reason and a completion condition or issue.
- Preserve unrelated dirty or untracked work. Do not silently move, mirror, migrate, or delete files.

## Documentation

- Keep current product contracts in `spec-*/references/` and maintained project conventions in `rule-*/references/`. Put dated investigations, implementation traces, and verification records in `docs/notes/` or clearly named audit documents.
- Separate accepted requirements, observed implementation facts, inferences, and unresolved decisions.
- Update the owning document instead of copying the same rule into several files or into this Skill.
- Use short sections for distinct topics, tables for repeated mappings, and diagrams only when relationships or state transitions are materially clearer visually.

## Verification

Read [references/testing.md](references/testing.md) when selecting gates. Start with the smallest tests that cover the changed behavior, then widen according to risk.

- Python formatting and lint: `.venv/bin/ruff format --check app tests` and `.venv/bin/ruff check app tests`
- Types: `.venv/bin/mypy app`
- Focused tests: `.venv/bin/python -m pytest -q <test paths>`
- Common local gate (lint, types, and tests): `make check`
- Security checks: `make security`
- Domain verification scripts under `scripts/` may start disposable PostgreSQL or build images; run them only when their domain and prerequisites match the change.

Do not claim integration, browser, container, migration, deployment, or production verification unless that exact check ran successfully.
