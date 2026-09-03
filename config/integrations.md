# External integration policy

The global provider catalog describes supported authentication modes and
capabilities. Each connection belongs to exactly one Workspace. Credentials,
OAuth PKCE verifiers, and webhook signing secrets are AES-GCM encrypted with a
versioned server key; responses never return stored credentials. Disconnecting
a connection removes credentials and its synchronization cursor.

OAuth state is random, stored only as a keyed digest, expires after ten minutes,
and is consumed once. The PKCE verifier stays encrypted server-side. Provider
drivers own authorization URLs, code exchange, credential validation, and sync
behavior behind a common interface.

Webhook endpoints use unguessable public identifiers and return signing secrets
only on creation. RLS permits unauthenticated lookup only for the exact public
identifier placed in transaction-local context. Signatures and payload limits
are checked before durable, idempotent delivery creation. Delivery attempts use
pending/processing/succeeded/failed/dead states and are dispatched in the worker
stage. Cursors advance only after successful processing.
