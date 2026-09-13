// @vitest-environment jsdom
import { workspaceClient } from "../../../apps/web/src/standard/workspace/workspace-client.js";
import { organizationClient } from "../../../apps/web/src/standard/organization/organization-client.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "agent_factory_csrf=; Max-Age=0";
});
describe("native management API operations", () => {
  it("sends revision-bearing Workspace edits with CSRF and no sentinel tenant header", async () => {
    document.cookie = "agent_factory_csrf=csrf-value";
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: "w", revision: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    await workspaceClient.updateWorkspace("org", "workspace", { name: "보존된 입력", revision: 2 });
    const [url, options] = fetch.mock.calls[0]!;
    expect(String(url)).toContain("/api/organizations/org/workspaces/workspace");
    expect(options?.headers).toMatchObject({ "X-CSRF-Token": "csrf-value" });
    expect(options?.headers).not.toHaveProperty("X-Organization-ID");
    expect(JSON.parse(String(options?.body))).toEqual({ name: "보존된 입력", revision: 2 });
  });

  it("keeps personal first creation explicit and separate from organization creation", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: "w" }), { status: 201, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);
    await workspaceClient.createWorkspace("personal-org", { name: "첫 작업공간", slug: "first" }, true);
    expect(String(fetch.mock.calls[0]![0])).toContain("/api/account/personal-workspaces");
  });

  it("uses revision-bearing group and role operations without local authority substitutes", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: "resource", revision: 4 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    await workspaceClient.recent("organization");
    await workspaceClient.updateGroup(
      "organization",
      { id: "group", name: "before", collapsed: false, revision: 3, workspace_ids: [] },
      { name: "after" },
    );
    const controller = new AbortController();
    await organizationClient.mutateOrganization(
      "organization",
      "roles/role",
      "PUT",
      {
        name: "역할",
        scope: "workspace",
        permissions: ["workspace.read"],
      },
      controller.signal,
    );
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/workspaces/recent"),
        expect.stringContaining("/groups/group"),
        expect.stringContaining("/roles/role"),
      ]),
    );
    expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body))).toEqual({ revision: 3, name: "after" });
    expect(fetch.mock.calls[2]![1]?.signal).toBe(controller.signal);
  });
});
