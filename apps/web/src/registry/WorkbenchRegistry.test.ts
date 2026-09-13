import { describe, expect, it, vi } from "vitest";
import { loadAuthorizedRegistry, nativeStandards, reservedStandardIds } from "./WorkbenchRegistry.js";

describe("authorized Workbench registry", () => {
  it("retains the code-owned Documents entry when no customer release is published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })),
    );
    const entries = await loadAuthorizedRegistry("organization-a", "workspace-a", new AbortController().signal);
    expect(entries.map((entry) => entry.id)).toEqual(["organization", "workspaces", "documents", "account"]);
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
    expect(entries.map((entry) => entry.id)).toEqual(["organization", "workspaces", "documents", "account"]);
    vi.unstubAllGlobals();
  });

  it("uses one stable reserved-ID set for every native management consumer", () => {
    expect([...reservedStandardIds]).toEqual(nativeStandards.map((entry) => entry.id));
    expect([...reservedStandardIds]).toEqual(["organization", "workspaces", "documents", "account", "administration"]);
  });

  it("projects administration only for the authenticated platform administrator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })),
    );
    const ordinary = await loadAuthorizedRegistry("organization-a", "workspace-a", new AbortController().signal);
    const administrator = await loadAuthorizedRegistry(
      "organization-a",
      "workspace-a",
      new AbortController().signal,
      true,
    );
    expect(ordinary.some((entry) => entry.id === "administration")).toBe(false);
    expect(administrator.at(-1)?.id).toBe("administration");
    vi.unstubAllGlobals();
  });
});
