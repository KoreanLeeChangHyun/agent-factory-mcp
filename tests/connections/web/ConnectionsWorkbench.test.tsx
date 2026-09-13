// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionsWorkbench } from "../../../apps/web/src/standard/connections/ConnectionsWorkbench.js";
import { providerClient } from "../../../apps/web/src/standard/connections/provider-client.js";

vi.mock("../../../apps/web/src/standard/connections/provider-client.js", () => ({
  providerClient: {
    catalog: vi.fn(),
    connections: vi.fn(),
    mcpConnections: vi.fn(),
    issueMcp: vi.fn(),
    mcpInstructions: vi.fn(),
    mcpConfiguration: vi.fn(),
    revokeMcp: vi.fn(),
    purgeMcp: vi.fn(),
    setToken: vi.fn(),
    beginOAuth: vi.fn(),
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ConnectionsWorkbench", () => {
  it("selects only retrievable MCP tokens and persists no plaintext", async () => {
    vi.mocked(providerClient.catalog).mockResolvedValue([]);
    vi.mocked(providerClient.connections).mockResolvedValue([]);
    vi.mocked(providerClient.mcpConnections).mockResolvedValue({
      state: "pending",
      connections: [
        {
          id: "valid",
          name: "Laptop",
          state: "pending",
          retrievable: true,
          expires_at: "2026-12-01T00:00:00Z",
          client_name: null,
          reason: null,
        },
        {
          id: "legacy",
          name: "Old",
          state: "reauth_required",
          retrievable: false,
          expires_at: null,
          client_name: null,
          reason: "legacy",
        },
      ],
    });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(<ConnectionsWorkbench organizationId="org" workspaceId="workspace" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).not.toContain("13개 클라이언트 설정 ZIP 다운로드");
    expect(host.querySelector<HTMLButtonElement>("button[disabled]")?.textContent).toContain("Old");
    act(() => host.querySelector<HTMLButtonElement>("button")?.click());
    expect(host.textContent).toContain("13개 클라이언트 설정 ZIP 다운로드");
    expect(localStorage.getItem("agent-factory:mcp-connection:v1:org:workspace")).toBe("valid");
    expect(JSON.stringify(localStorage)).not.toContain("afm_");
    act(() => root.unmount());
  });

  it.each(["pending", "verified", "reauth_required"] as const)(
    "consumes the %s aggregate MCP status presentation",
    async (state) => {
      vi.mocked(providerClient.catalog).mockResolvedValue([]);
      vi.mocked(providerClient.connections).mockResolvedValue([]);
      vi.mocked(providerClient.mcpConnections).mockResolvedValue({
        state,
        connections: [
          {
            id: state,
            name: state,
            state,
            retrievable: state !== "reauth_required",
            expires_at: null,
            client_name: null,
            reason: state === "reauth_required" ? "expired" : null,
          },
        ],
      });
      const host = document.createElement("div");
      const root = createRoot(host);
      await act(async () => {
        root.render(<ConnectionsWorkbench organizationId="org" workspaceId="workspace" />);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(host.textContent).toContain(state);
      act(() => root.unmount());
    },
  );
});
