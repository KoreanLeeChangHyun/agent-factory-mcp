# Document search policy

Document search is a rebuildable projection, never the authority for Document
content. Each Workspace owns one or more embedding profiles recording provider,
model, and dimensions. The initial deployment standardizes on 1,536 dimensions
so one HNSW cosine index remains predictable.

Indexing replaces all chunks for the same Document and profile atomically.
The indexer reads bytes from the authoritative immutable revision; callers
cannot submit alternate text under an existing revision identity. Binary PDF
and office files must first produce a text Processed Document.
PostgreSQL row-level security applies before retrieval. Search combines vector
similarity (70%) with the built-in `simple` full-text configuration (30%). The
simple configuration avoids language-specific stemming surprises for mixed
Korean, English, identifiers, and source material; language-aware analyzers may
be added as distinct profiles.

Embedding credentials remain server-side. The deterministic provider is only
available in local and test environments. Re-embedding is safe because chunks
are derived state tied to an immutable Document revision and embedding profile.

Before production rollout, benchmark representative per-tenant and cross-tenant
corpora with `EXPLAIN (ANALYZE, BUFFERS)` and record recall plus p50/p95 latency.
Keep the shared table while tenant filtering preserves acceptable recall and
latency. Introduce hash partitioning by Workspace only when measured corpus size
or tenant skew makes index maintenance or filtered HNSW recall unacceptable.
