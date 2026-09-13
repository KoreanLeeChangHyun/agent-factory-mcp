# App retirement runtime evidence

This Processed evidence records the initial removal turn for Work run
`run-20260913T181802893735Z-bcf945a2`. It is a preservation and Verification handoff,
not evidence that any API, MCP, worker, browser, database, or package entrypoint starts.

## Reversible source preservation

| Field | Observed value |
| --- | --- |
| Original project path | `/home/deus/workspace/agent-factory/mcp/app` |
| External backup root | `/home/deus/workspace/agent-factory-backups/mcp-app-20260913T181900Z` |
| Preserved tree | `/home/deus/workspace/agent-factory-backups/mcp-app-20260913T181900Z/app` |
| Preservation manifest | `/home/deus/workspace/agent-factory-backups/mcp-app-20260913T181900Z/manifest.json` |
| Manifest SHA-256 | `9a9934b075c46e339a4756a6ca66b492b5e699943e26177666485f470663bcd3` |
| Manifest timestamp | `2026-09-13T18:19:38.099160+00:00` |
| Regular files | 445 |
| Directories | 66 |
| Regular-file bytes | 6,420,022 |
| Symlinks | 0 |
| Empty directories | 0 |

The manifest contains project-relative paths, modes, byte lengths, and SHA-256 values
for every regular file. It has separate symlink target, directory, and empty-directory
inventories. It records metadata only and contains no file bodies. The complete tree,
including dirty, untracked, ignored cache, resource, migration, and package files, was
moved to the unique backup after the manifest was written. No active `app` package,
shim, symlink, alias, or backup runtime dependency was created.

## Independent Verification handoff

Work intentionally ran no application entrypoint, test, lint check, type check, build,
migration, server, browser, or database probe. Independent Verification should now run
the configured production command and the target API and worker entrypoints separately,
capture all initial failures together, and confirm no process remains afterward. Repairs
must be driven by those observed failures and must not import from this backup.
