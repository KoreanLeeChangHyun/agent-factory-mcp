# Directory Structure and Ownership

The single maintained directory contract is
[the accepted repository structure](../../rule-workbench-structure/references/target-structure.md).
Read it before placing or moving files. It owns the complete tree, fixed root
boundary, app/package responsibilities, test classification, deployment location,
and protection of Human-owned `feedback/` and `uploads/`.
Legacy `app/`, `static/`, and `template/` paths in historical records are not
instructions to recreate those roots.

## Repository boundaries

- This repository owns the cloud service, web UI, MCP application, shared business logic, workers, deployment, and tests.
- The sibling Agent Factory plugin owns distributable Skills and local execution-loop behavior. Do not mirror those contracts here.
- Consumer repositories do not receive this server, browser bundle, or a project-local Workspace runtime.
- Preserve ignored local data and tool artifacts. They are not authoritative source, and reorganization does not authorize deleting them.
- Keep secrets and credentials out of Git, generated documents, logs, and test fixtures.

## Placement decisions

- Extend the existing owner before proposing a new structural group.
- Add shared abstractions only when real consumers need the same behavior and no domain is its natural owner.
- Keep generated assets distinct from editable sources and preserve their generation contract.
- Classify tests by the app or package they verify; keep all tests and test-only helpers under root `tests/`.
- Apply `rule-documents` to Original, Processed, and Specification documents. Keep agent-facing Specifications in the owning Skill and their Human-facing HTML projection under `docs/specification/<identity>/`.
- Use the owning Specification rather than maintaining competing directory tables.
