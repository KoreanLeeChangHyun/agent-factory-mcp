---
name: spec-platform
description: Locate and apply the current Agent Factory MCP cloud platform specifications in this repository. Use for product behavior, domain models, API or MCP contracts, authorization, persistence, operations, and acceptance decisions; do not use dated audits or implementation notes as requirements by default.
---

# Platform Specifications

Treat this Skill's `references/` as the maintained specification source. Detailed contracts live there instead of a parallel `docs/` copy.

## Resolve the specification

1. Identify the domains affected by the request.
2. Read the matching rows in [references/specification-index.md](references/specification-index.md), then read each linked document completely before changing behavior.
3. Inspect current code, migrations, and tests to establish implementation facts. Do not silently reinterpret a specification to match existing code.
4. If documents conflict, prefer the more specific current contract over a broad summary. Report unresolved conflicts instead of inventing a merged requirement.
5. Apply `$rule-project` for file placement, implementation conventions, and verification scope.

## Authority and evidence

- The Human's explicit instruction for the task is authoritative.
- A maintained policy or domain contract states intended behavior. Code and tests show current behavior but do not automatically override it.
- Dated audits, rollout logs, implementation trackers, and `docs/notes/` are evidence. Read them when history, completion status, or prior verification matters; do not promote them into requirements without an accepted decision.
- External references explain upstream behavior but do not override local product decisions.
- Preserve documented unresolved items as unresolved. Do not infer live deployment, configured credentials, migrated data, or completed acceptance from source availability.

## Change discipline

- Update the owning specification when an authorized implementation changes an accepted contract.
- Keep authorization, tenant isolation, immutable history, credential secrecy, idempotency, and failure behavior explicit across every affected interface.
- Check paired surfaces together: route and service, schema and migration, worker and durable job state, MCP schema and HTTP behavior, UI control and server authorization.
- For broad changes, state which specifications were applied and which historical evidence was intentionally not treated as normative.
