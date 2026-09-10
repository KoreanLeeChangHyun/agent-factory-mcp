# Document storage policy

Documents belong to one Workspace and have one of three semantic types:
Original, Processed, or Specification. Metadata and immutable revision records
are authoritative in PostgreSQL. Revision bytes are stored under tenant-scoped,
server-generated keys in the configured S3-compatible object store.

Provenance is deliberately a loose graph. A Processed Document may identify the
Original Documents it processed, and a Specification may identify the Processed
Documents it specifies without changing the authority of either record.

Uploads are size- and media-type constrained, filenames are reduced to a single
safe path component, and checksums are recorded. A failed database transaction
triggers removal of the newly uploaded object. Document deletion is initially a
recoverable metadata soft-delete; object lifecycle and retention jobs perform
eventual physical deletion.
