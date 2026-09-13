# Cloud Documents v1

This module adds authenticated, workspace-scoped Document imports, immutable revisions,
package inspection, lexical indexing and paired Specification publication. Original,
Processed and Specification remain logical types. Imports preserve type and slug; they
never promote evidence. Existing provenance relationships remain optional and many-to-many.
Plugin Skills remain Git-owned: package snapshots preserve their repository, commit,
paths and SHA-256 inventory without rewriting the Git source.

## Integration hooks

The shared application now installs `install_documents(server, _authorized_session)`,
registers `DocumentImport`, `DocumentText`, and `DocumentUpload`, and includes the
cloud HTTP router. Existing Document/reporting/planning tools are retained.
Migration ordering is `0017 -> 0018 -> 0019 -> 0020 -> 0021`; application code
registration does not apply these migrations or import existing data.

New workspace credentials receive `document:write` only with `document.manage`.
Existing credentials keep their recorded scopes. Explicit API write-token issuance
requires a Workspace and checks its current permission; call-time authorization
also checks current active Workspace and membership. PyYAML is a direct dependency.
The successful authenticated preview endpoint preserves its exact server-owned
headers through shared middleware; errors, member downloads and other routes retain
ordinary application framing policy. The preview runtime and browser resources are
included in the wheel and image. See `cloud-platform.md` for the unexecuted,
disposable integration Verification harness and cutover limits.

No worker registration is necessary: extraction is synchronous and bounded. HTTP import
and reindex use the existing session, RBAC and CSRF dependencies. Search is read-only.
Existing editor routes remain at `/documents`; the new HTTP prefix is
`/api/organizations/{organization_id}/workspaces/{workspace_id}/cloud-documents`,
with POST `/imports`, `/search`, and `/index`.

## Request contract

Every new request requires `schema_version: "1"` and rejects unknown fields.
`document_import` accepts `ImportRequest` from `cloud_schemas.py`. Send base64 content,
its exact SHA-256, an idempotency key, source identity and collection context, title,
slug, type, filename and media type. A new identity has no `document_id` and requires
`expected_revision: 0`; a revision requires the existing ID and exact current content
revision number. The same key and exact request return the prior receipt. Changing
any request field under that key conflicts. Different keys targeting an existing slug
never overwrite it implicitly. A deleted import target is not resurrected by retry.

Inline import content is limited to 256 KiB. For larger files use staged binary delivery
below. Both paths use the shared import, pair validator, package parser and publication
transaction. Native PDF, DOCX and image formats supported by ordinary uploads are
preserved byte-for-byte; they are not coerced into text or ZIP. Their text extraction
remains unavailable. ZIPs are inspected in memory, never extracted to the filesystem.
Safe relative NFC paths (at most 32 components), no links/special files, encryption,
case/path collisions or unsupported compression remain mandatory. Nested archives
remain opaque. Malformed supported UTF-8 text or JSON fails closed.

Example text import (compute the base64 and SHA-256 from the same bytes):

```json
{
  "schema_version": "1",
  "idempotency_key": "notes-import-1",
  "expected_revision": 0,
  "title": "회의 기록",
  "slug": "meeting-notes",
  "document_type": "original",
  "filename": "notes.md",
  "media_type": "text/markdown",
  "content_base64": "aGVsbG8=",
  "source_sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "source_identity": "git:repository/notes.md",
  "collection_context": "Human-authorized upload from resolved repository"
}
```

`document_write` has discriminated `create`, `update`, `delete` and `provenance`
operations, reusing Document metadata schemas with unknown fields rejected and a
32,000-character serialized command bound. Deletion uses existing soft deletion.
`document_read` supports `get`, `revisions`, `provenance`, and `download` (base64, 256 KiB).
`document_index` takes document ID and revision number; it supports existing bounded
text, JSON and ZIP revisions without invoking an embedding provider.

## Paired Specifications

Specification imports require one ZIP containing exactly one AI root and one Human
root (plus their internal files), the same stable identity, Git repository and commit,
and inspectable semantic-review evidence with reviewer, authority reference and an
`aligned` attestation bound to both representation hashes. These are caller-supplied
review records preserved for inspection, not an automated semantic verdict or proof
that the named reviewer independently approved them. The authenticated publication
actor is recorded on the immutable revision. Acceptance remains Human-owned.

The package must contain AI `SKILL.md` and Human `index.html`, `styles.css`, and
`app.js`. Reciprocal Skill frontmatter and Human `agent-factory:*` metadata must bind
the same package-relative locators. Human HTML must declare `lang="ko"`, have no template
placeholders and include Korean text in each mapped block. The complete ordered AI
source inventory consists of `SKILL.md` first, then every Markdown source and YAML in
`agents/`, in sorted path order. Human source containers use `data-ai-source` and
`data-ai-sha256`; contiguous blocks use `data-source-lines="start-end"` and
`data-source-sha256`. Every source line must be covered exactly once with a matching
hash. Valid, explicitly closed HTML elements are required by the coverage parser.

Review representation hashes are SHA-256 over UTF-8 JSON of the sorted mapping
`{relative_path_within_root: file_sha256}`, serialized with `sort_keys=True` and
`separators=(",", ":")` (Python's default ASCII JSON escaping). Every file in each
root is included. Hashes bind reviewed content and establish coverage integrity;
they cannot demonstrate translation fidelity. The recorded semantic state is
`review_attested`, not machine-verified equivalence.

The whole pair is stored in one unique immutable object and read back for SHA-256
comparison before publication. Its revision, current revision pointer, index and
idempotency receipt commit together in one database transaction. A malformed pair,
stale review, failed object write or database failure leaves the prior publication
pointer intact. The object store and database do not share a transaction: uniquely
keyed staging objects may remain after failure. They are deliberately retained,
including after ambiguous commit acknowledgement, so recovery cannot accidentally
delete an already-published revision. Retention/recovery is an integration concern.

The ordinary revision-upload service now rejects one-sided Specification content
uploads; Original and Processed upload behavior is preserved. Ordinary metadata
updates preserve the reserved `cloud_pair_revision` publication marker. Create actual
Specifications through the complete-pair import endpoint. Existing legacy metadata
records can still exist without a valid pair and are not asserted to be publications.
Human browser delivery uses the isolated package preview described below; the member
endpoint serves downloads only and never executes uploaded HTML on the application origin.

## Lexical projection and verification handoff

`document_search` needs only a query and limit. It uses escaped, case-insensitive
substring predicates, including Korean fragments and underscore-containing identifiers,
with all whitespace-separated terms required in a chunk. It queries only current,
non-deleted revisions in the authorized workspace. No embedding profile or provider
is called. Chunks retain their package source path; JSON, text and Human HTML text
are projected. Script/style bodies are excluded from HTML text extraction.

This is basic lexical retrieval, ordered by document update time and chunk position;
it does not claim semantic ranking or morphological tokenization. Substrings crossing
chunk boundaries can be missed. SQL substring scanning may need a trigram index when
corpus volume warrants it. Older revisions need explicit `document_index` calls;
existing embedding search and worker behavior are unchanged.

Work did not run tests, validators, builds or providers. Proposed independent focused
command: `.venv/bin/pytest tests/knowledge/regression/test_cloud_documents.py tests/knowledge/regression/test_documents.py`.
The new unit/service cases cover hashes, version/unknown fields, path escape, ZIP
symlinks/bombs/collisions, text/JSON/package extraction, pair coverage and stale reviews,
service permission checks, retry/conflict behavior, prior publication preservation,
and tenant/escaped lexical SQL construction. PostgreSQL RLS, concurrent transaction
races, actual search results, migration upgrade and object-store failure recovery
still require isolated infrastructure checks by Verification. No live database,
deployment, provider credential or cloud cutover was checked by Work.

## Large document delivery

Call `document_prepare_upload` with all `ImportMetadata` fields plus exact `size_bytes`,
without `content_base64`. Its small response binds one upload ID, relative HTTP path,
15-minute expiry, expected size/digest and `X-Document-Upload-Capability` value. PUT the
raw bytes to that path on the already resolved MCP server, supplying the capability
header **and** the existing `Authorization: Bearer <API token>` with `document:write`.
Browser callers may instead use their session cookie plus the existing CSRF header.
Never put either token in a URL or log. No local path or arbitrary fetch URL is accepted.
The API token goes only to its resolved server; an upload intent is not a new token
issuance or provider credential store. The intent stores only the capability hash.
The upload route reuses `ApiTokenVerifier` and the shared RBAC authorizer, enforces token
Workspace binding and rechecks the intent owner. Finalization uses the authenticated
MCP `document_finalize_upload` with `{schema_version: "1", upload_id: "..."}`.
HTTP browser equivalents are POST `/uploads/prepare` and `/uploads/finalize` with CSRF.

Streaming input is checked before each accumulation against declared size and the
configured upload cap, then compared with the digest. Staged bytes are read back.
Finalization rechecks size/digest, validates the whole package and complete pair,
then uses the existing target revision precondition and publication transaction.
No file body is returned in the prepare/finalize MCP result. Metadata remains closed.
Reusing an idempotency key with changed metadata conflicts. Retrying prepare with the
same owner and metadata renews expiry and rotates the capability under a row lock;
use the newest capability. Existing uploaded bytes are retained. Successful finalize
retries return the original import receipt, even after expiry. Deleted targets remain
unavailable; a new idempotency key never bypasses target revision checks.

A durable upload row serializes prepare/upload/finalize on that intent. A failed or
ambiguous publication retains its staging object. Resume by authenticated prepare
of the exact original metadata, then upload if necessary and finalize the same intent.
Never delete objects automatically after uncertain commits. A digest mismatch in an
already acknowledged staging object fails closed for operator investigation. Retention,
quota enforcement across many intents, garbage collection, and source retirement are
separate operational work; no deletion or live cutover is performed here.

| Bound | Default | Hard upper cap | Configuration |
| --- | ---: | ---: | --- |
| Uploaded bytes | 25 MiB | 128 MiB | existing `document_max_upload_bytes` |
| ZIP expanded bytes | 64 MiB | 256 MiB | `DOCUMENT_PACKAGE_EXPANDED_BYTES` |
| ZIP member bytes | 16 MiB | 64 MiB | `DOCUMENT_PACKAGE_MEMBER_BYTES` |
| ZIP entries | 2,048 | 8,192 | `DOCUMENT_PACKAGE_ENTRIES` |
| Member compression ratio | 200:1 | 1,000:1 | `DOCUMENT_PACKAGE_RATIO` |

Package values can alternatively be supplied as settings attributes named
`document_package_expanded_bytes`, `document_package_member_bytes`,
`document_package_entries`, and `document_package_ratio`. Values are clamped to
positive hard bounds, with invalid non-integer configuration rejected. The existing
upload setting remains authoritative. The standalone parser's omitted-limits legacy
contract stays 4 MiB/256 entries/100:1; all cloud import, indexing and delivery paths
explicitly supply configured limits.

Read-only source inventory on 2026-09-06 of sibling `../plugin/skills/<id>` plus
`../plugin/docs/specifications/<id>` found Document: 28 files,
8,189,698 expanded bytes; Agent: 24 files, 4,598,001 bytes. The largest observed member
is `vendor/mermaid/11.17.2/mermaid.min.js` (3,572,661 bytes). No required file was removed
or rewritten to fit a fixture. These are local inventory measurements, not evidence
of successful ingestion, semantic alignment, or cloud deployment. The base pair
validator still requires complete source coverage hashes and review metadata; fitting
the byte bounds does not mean an unchanged plugin snapshot satisfies that contract.

## Package reading and isolated Human preview

Authenticated revision-scoped GET paths beneath
`/cloud-documents/{document_id}/revisions/{revision_number}/package` are:

- the base path: digest/size manifest and resolved Human entry;
- `/member?path=<exact package path>`: attachment bytes, always octet-stream;
- `/preview`: trusted wrapper containing the validated package for browser reading.

Every request authorizes Workspace membership and document visibility, selects the
exact revision, checks its stored digest/size and validates the complete archive.
Member selection is an exact validated inventory lookup, never ZIP extraction, local
filesystem access, or direct object-store addressing. Specification entry comes from
that immutable revision's paired Human root. Generic packages can preview `index.html`.

Workspace `loadContent` now opens ZIP Human entries in a sandbox with `allow-scripts`
and **without** `allow-same-origin`. The server wrapper has its own CSP sandbox and
places package HTML in a second opaque-origin iframe. The trusted wrapper's `frame-src
blob:` constrains child navigation as well as nested frames. Package code has no
parent DOM, storage, cookies, popups, top navigation, forms, workers, network fetch or
external image/script/font access. Local classic scripts, styles, CSS imports, images,
fonts and ordinary relative HTML links are resolved against the validated package
inventory into data resources. Classic scripts retain their `src`, ordering, `defer`
and `async` attributes; base64 data URLs avoid crossing opaque origins with
wrapper-owned blob URLs. The preview-only `script-src` permits inline/data scripts,
without adding network sources or same-origin access. Fragment links, tabs and local SVG diagrams remain
interactive. Package nodes are never inserted into the trusted wrapper's document.

External dependencies, dynamic JavaScript fetch/import resolution and eval-dependent
libraries are not enabled. CSS URL rewriting covers conventional `url()` and quoted
`@import` syntax, not a full CSS parser; unusual escaped URL syntax may fail to display
while CSP still blocks network access. Responsive `srcset` and nested frames/objects
are not rendered. Original bytes and all assets remain available in the file list and
whole-package download. The readable HTML is the primary view, not a download fallback.

**Required shared header integration:** `SecurityHeadersMiddleware` currently overwrites
route headers and sets `X-Frame-Options: DENY`. For the exact authenticated GET route
`/api/organizations/{organization_id}/workspaces/{workspace_id}/cloud-documents/{document_id}/revisions/{revision_number}/package/preview`
(including a configured root prefix), preserve the server-owned `PREVIEW_HEADERS` from
`app.modules.document.preview`. In particular preserve its CSP with `sandbox
allow-scripts`, `frame-src blob:`, `connect-src 'none'`, `frame-ancestors 'self'`, and
`X-Frame-Options: SAMEORIGIN`. Do not weaken the Workspace shell CSP or apply an
exception to member/download routes. Without this narrow integration the preview is
blocked, so production readability is not yet integrated. No shared security file was
changed by this Work. No new runtime dependency is required for preview or delivery.

Apply `0021_cloud_document_delivery.py` (revision `0021`, after shared `0020`) and
register `DocumentUpload`. Its table has forced Workspace RLS. Do not apply migrations
from Work. Package delivery holds bounded bytes in memory; higher settings increase
memory and synchronous extraction costs. Put upload duration/concurrency and aggregate
staging quotas in the production ingress/operations plan; the current route limits
bytes, not total time or total storage across different intents.

## Delivery Verification handoff

Tests were authored, not executed by Work:

- `.venv/bin/pytest tests/knowledge/regression/test_cloud_document_delivery.py tests/knowledge/regression/test_cloud_document_delivery_http.py tests/knowledge/regression/test_cloud_documents.py`
- `NODE_PATH=/tmp/af-pw/node_modules node tests/knowledge/browser/cloud-document-delivery.cjs`
  (`PYTHON` may select the application virtualenv). This test invokes its Python fixture
  generator, uses real preview runtime and editor methods, and applies the documented
  preview header contract on a local fixture server.
- Retain the existing focused `tests/knowledge/browser/document-editor.cjs` regression check.

The browser fixture exercises Korean HTML, relative CSS imports, classic JS, image,
explicit script initialization, blocking/deferred dependency order, script-load errors,
tabs, SVG diagram, internal page links, disposal, and attempted parent/storage/cookie/
top-navigation/fetch/image/self-navigation attacks. It does not substitute for testing
the shared header hook on the integrated application. PostgreSQL RLS, simultaneous
connections, migration upgrade, API-token HTTP authorization and ambiguous object-store
commit failures also need independent isolated integration coverage. Full migration
step 13, live upload, source retirement, provider calls and deployment remain unclaimed.

## New Specification authoring baseline

The authenticated `document_template` tool uses the same `document:read` scope,
Workspace binding and current `workspace.read` permission as other Document reads.
Call with `request={"operation":"manifest"}` to receive the complete filename,
size and SHA-256 inventory plus its version. For each member call
`request={"operation":"read","path":"index.html","version":"<manifest version>","offset":0,"limit":65536}`
and follow `next_offset` until null. Reassemble bytes, compare each member digest
and retain the complete inventory and third-party notices. A changed server
package rejects an old version; start again from its manifest. All results are
JSON/base64 data, never HTML served for execution on the authenticated origin.

Resources live in packaged `app/resources/document_template/`, preserving the
original plugin baseline bytes including Tabulator and Mermaid licenses. This
is a copy-once baseline for an absent new source package, never an accepted pair
or permission to overwrite an existing Specification. Resolve identity, replace
all placeholders, write the complete Korean/AI pair, and obtain independent
coverage and semantic review before publication. Existing Human publication
packages retain their own local CSS/JS/vendor dependencies. Imported packages
continue to use attachment/member delivery and the isolated preview CSP; this
tool adds no static mount, browser origin or uploaded-script execution route.

