# Design-system catalog policy

The TypeScript `assetCatalog` is the single descriptor source used by the author preview and runtime registry. Every public ID has one implementation, a closed property allowlist, allowed region, states, actions, accessibility notes, provenance, and a synthetic example.

Stable `@1` IDs are immutable. A replacement receives a new major ID; aliases that overlap in meaning are prohibited. A deprecated implementation remains available for one release window, names its replacement, and is removed only in the next major version after consumer inventory and preview gates complete.

`catalog/provenance.json` binds exact-byte reviewed multicolor imports to their legacy locations and preserves the Material Icon Theme and Tabler license/provenance inputs. The full vendor bundle remains a file-tree input rather than becoming a public task-icon catalog.
