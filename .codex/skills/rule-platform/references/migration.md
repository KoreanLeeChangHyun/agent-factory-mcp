# Legacy Workspace cutoff

The SaaS application is the sole Workspace runtime and Document authority.
Legacy plugin launchers, copied browser assets, project-local Workspace state,
and SQLite Workspace projections are unsupported after cutoff. Do not delete a
legacy Document tree merely because the application starts successfully.

## Migration procedure

1. Stop writers to the legacy project-local Document tree.
2. Create a recoverable backup outside the source tree.
3. Run `python -m app.modules.document.legacy_import --source <project>
   --manifest .backup/legacy-documents.json` without `--apply`.
4. Review `item_count`, each source-relative path, size, and SHA-256 digest.
5. Ensure all packages fit `AGENT_FACTORY_DOCUMENT_MAX_UPLOAD_BYTES` and the
   destination user, organization, and workspace already exist.
6. Add `--apply --organization-id <uuid> --workspace-id <uuid> --user-id
   <uuid>`. The configured PostgreSQL and S3-compatible services receive the
   records and immutable revision bodies.
7. Run the dry run again and compare its `items_sha256` with the retained
   manifest. Confirm destination Document counts and download representative
   revisions for an independent hash check.
8. Keep the backup through the retention period. Remove the old tree only as a
   separate, explicitly approved operation.

The importer is source-preserving and resumable. A destination slug with the
same recorded legacy digest is skipped; a different digest fails closed. A
multi-file package becomes a deterministic ZIP revision, retaining every
relative file path and byte sequence. Symlinks, special files, and empty
packages are rejected.
