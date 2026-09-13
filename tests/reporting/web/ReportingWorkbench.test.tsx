// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportingWorkbench } from "../../../apps/web/src/standard/reporting/ReportingWorkbench.js";
import { reportingClient } from "../../../apps/web/src/standard/reporting/reporting-client.js";

vi.mock("../../../apps/web/src/standard/reporting/reporting-client.js", () => ({
  reportingClient: { snapshot: vi.fn(), detail: vi.fn() },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.restoreAllMocks());

describe("ReportingWorkbench", () => {
  it("renders hierarchy, input-required work, history and evidence links", async () => {
    vi.mocked(reportingClient.snapshot).mockResolvedValue({
      agents: [
        {
          id: "agent",
          parent_id: null,
          owner_user_id: "owner",
          name: "Reviewer",
          role: "review",
          responsibilities: "Verify evidence",
          last_report_at: null,
        },
      ],
      tasks: [
        {
          id: "task",
          agent_id: "agent",
          name: "Review",
          status: "input_required",
          progress: 40,
          last_report_at: "2026-09-13T00:00:00Z",
          runtime_observation: { fact: "process_alive", observed_at: "2026-09-13T00:00:01Z" },
        },
      ],
      truncated: false,
      server_time: "2026-09-13T00:00:10Z",
      stale_after_seconds: 300,
    });
    vi.mocked(reportingClient.detail).mockResolvedValue({
      task: {
        id: "task",
        agent_id: "agent",
        name: "Review",
        description: "",
        status: "input_required",
        progress: 40,
        last_report_at: "2026-09-13T00:00:00Z",
        runtime_observation: { fact: "process_alive", observed_at: "2026-09-13T00:00:01Z" },
        parent_id: null,
        plan_item_id: null,
        started_at: "2026-09-13T00:00:00Z",
        finished_at: null,
      },
      reports: [
        {
          id: "report",
          revision: 2,
          status: "input_required",
          progress: 40,
          message: "Approval needed",
          received_at: "2026-09-13T00:00:00Z",
        },
      ],
      results: [
        {
          id: "result",
          report_id: "report",
          label: "Evidence",
          summary: "Review result",
          document_id: "document",
          url: null,
        },
      ],
      next_before_revision: null,
      server_time: "2026-09-13T00:00:10Z",
      stale_after_seconds: 300,
    });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(<ReportingWorkbench organizationId="org" workspaceId="workspace" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Verify evidence");
    expect(host.textContent).toContain("Approval needed");
    expect(host.querySelector('a[href="/documents/document"]')?.textContent).toBe("Evidence");
    act(() => root.unmount());
  });
});
