import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleClient } from "../../../apps/web/src/standard/schedule/schedule-client.js";

afterEach(() => vi.unstubAllGlobals());

describe("scheduleClient", () => {
  it("keeps organization and workspace identity in the planning request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          can_edit: false,
          calendar: { country: "KR", holidays: {} },
          settings: { launch_date: null, revision: 0 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await scheduleClient.read("org / one", "workspace / one");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/organizations/org%20%2F%20one/workspaces/workspace%20%2F%20one/plan",
    );
  });
});
