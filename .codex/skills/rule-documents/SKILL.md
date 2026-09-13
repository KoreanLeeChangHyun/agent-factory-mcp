---
name: rule-documents
description: Classify, create, move, or review repository documents using the Original, Processed, and Specification lifecycle. Use for documentation structure, promotion, provenance, and deciding whether knowledge belongs in docs or a project Skill.
---

# Document Lifecycle Rules

Keep document authority visible in its path.

## Three stages

| Stage | Owner | Content |
| --- | --- | --- |
| Original | `docs/original/` | External source material, unchanged evidence, captured inputs, and source kits |
| Processed | `docs/processed/` | Analysis, audits, proposals, implementation traces, and verification records |
| Specification | `docs/specification/<category>-<name>/` paired with `.codex/skills/<category>-<name>/` | Accepted information, integrated design, and repeatable agent rules |

Specification categories are limited to `info-*`, `design-*`, and `rule-*`. Use `info-*` for information Agents consult, `design-*` for integrated planning intent and technical design, and `rule-*` for rules Agents must follow.

Every Specification has two synchronized projections with one identity and version: an English AI-facing Skill at `.codex/skills/<category>-<name>/` and a Human-facing HTML package at `docs/specification/<category>-<name>/index.html`. Neither projection replaces the other.

## Promotion and provenance

- Classify by authority and purpose, not file extension, polish, or age.
- A Processed document may exist without an Original, and a Human may establish a Specification directly.
- Promotion does not mutate or erase provenance. Link to the inputs and record the accepting authority or decision.
- Do not copy the same normative rule across stages. Update the owning Specification and make other documents link to it.
- Dated notes never become normative merely because implementation matches them.
- Do not place secrets, credentials, user uploads, build output, or runtime logs in any documentation stage.

Before moving documents, update repository-relative links, commands, packaging references, and tests that name the old path. Preserve third-party licenses and provenance beside their Original source kit.

Keep `README.md` only at the repository root. Give nested Human-facing documents purpose-specific names such as `GUIDE.md`, `POLICY.md`, `STRUCTURE.md`, or `UPSTREAM.md`; put repeatable agent instructions in the owning Skill.
