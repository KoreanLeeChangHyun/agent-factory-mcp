// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentsWorkbench } from "../../../apps/web/src/standard/agents/AgentsWorkbench.js";
import { agentClient } from "../../../apps/web/src/standard/agents/agent-client.js";

vi.mock("../../../apps/web/src/standard/agents/agent-client.js", () => ({
  agentClient: { definitions: vi.fn(), runs: vi.fn(), evidence: vi.fn(), cancel: vi.fn(), retry: vi.fn() },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.restoreAllMocks());

describe("AgentsWorkbench", () => {
  it("shows usage, events, tools, artifacts and linked documents for a selected run", async () => {
    vi.mocked(agentClient.definitions).mockResolvedValue([
      { id: "agent", name: "Worker", slug: "worker", description: "", status: "active", revision: 1 },
    ]);
    const run = {
      id: "run",
      definition_id: "agent",
      version_id: "version",
      status: "succeeded",
      created_at: null,
      input_tokens: 4,
      output_tokens: 8,
      estimated_cost_usd: 0.01,
      error_code: null,
      error_message: null,
    };
    vi.mocked(agentClient.runs).mockResolvedValue([run]);
    vi.mocked(agentClient.evidence).mockResolvedValue({
      run,
      events: [
        { id: "event", sequence: 1, event_type: "run.succeeded", payload: {}, created_at: "2026-09-13T00:00:00Z" },
      ],
      tool_calls: [{ id: "tool", tool_name: "document.read", status: "succeeded", error_message: null }],
      artifacts: [{ id: "artifact", kind: "result", storage_key: null, metadata: {} }],
      documents: [{ id: "link", document_id: "document", relation: "output", document_title: "Result" }],
    });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(<AgentsWorkbench organizationId="org" workspaceId="workspace" permissions={["agent.read"]} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>("article button")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("document.read");
    expect(host.textContent).toContain("USD 0.010000");
    expect(host.querySelector('a[href="/documents/document"]')?.textContent).toBe("Result");
    act(() => root.unmount());
  });
});
