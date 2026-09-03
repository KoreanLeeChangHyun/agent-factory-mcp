# Verification gates

Pull requests must pass formatting, lint, type checking, unit/API/security tests,
minimum coverage, Bandit, dependency vulnerability audit, a clean PostgreSQL
migration to head, and an immutable container build. Integration tests require
explicit infrastructure and never silently use a developer database.

The initial whole-application coverage floor is 50%. It is a ratchet: releases
may raise it as coverage grows, but must not lower it to accommodate regressions.

Deployments run `deploy/smoke.sh` against staging before promotion. Smoke tests
cover liveness, readiness, static Workspace delivery, and fail-closed admin
authentication. Destructive migration downgrade and full backup restore are
scheduled release rehearsals rather than per-commit CI operations.
