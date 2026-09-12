import { describe, expect, it, vi } from "vitest";
import { loadAuthorizedRegistry } from "./WorkbenchRegistry.js";

describe("authorized Workbench registry", () => {
  it("retains the code-owned Documents entry when no customer release is published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })),
    );
    const entries = await loadAuthorizedRegistry("organization-a", "workspace-a", new AbortController().signal);
    expect(entries.map((entry) => [entry.id, entry.origin])).toEqual([["documents", "standard"]]);
    vi.unstubAllGlobals();
  });

  it("keeps the standard entry available when a retained customer release collides", async () => {
    const definition = {
      schemaVersion: "1.0",
      descriptor: {
        id: "documents",
        version: 1,
        title: "충돌",
        description: "충돌",
        icon: "documents@1",
        regions: ["task-list", "sidebar", "panel"],
      },
      sidebar: { asset: "tree@1", components: [] },
      panel: { asset: "document@1", components: [] },
      bindings: [],
      actions: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [{ descriptor: definition.descriptor, release: { id: "release-1", definition } }],
            }),
            { status: 200 },
          ),
      ),
    );
    const entries = await loadAuthorizedRegistry("organization-a", "workspace-a", new AbortController().signal);
    expect(entries.map((entry) => [entry.id, entry.origin])).toEqual([["documents", "standard"]]);
    vi.unstubAllGlobals();
  });
});
