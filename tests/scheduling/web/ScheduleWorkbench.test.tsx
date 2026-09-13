// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canChangeKanbanStatus,
  confirmDeletion,
  deletePlanItem,
  Editor,
  kanbanItems,
  timelineTicks,
  todayGroups,
} from "../../../apps/web/src/standard/schedule/ScheduleWorkbench.js";
import type { PlanItem } from "../../../apps/web/src/standard/schedule/schedule-client.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const item = (
  id: string,
  start: string | null,
  target: string | null,
  status: PlanItem["status"] = "active",
): PlanItem => ({
  id,
  workspace_id: "workspace",
  parent_id: null,
  kind: "feature",
  name: id,
  description: "",
  acceptance: "",
  assignee: "",
  status,
  blocked_reason: "",
  start_date: start,
  target_date: target,
  revision: 1,
});

describe("todayGroups", () => {
  it("includes spanning and single-date work while excluding domains", () => {
    const domain = { ...item("domain", "2026-09-01", "2026-09-30"), kind: "domain" as const };
    const groups = todayGroups(
      [
        item("spans", "2026-09-01", "2026-09-30"),
        item("starts-today", "2026-09-13", null),
        item("targets-today", null, "2026-09-13"),
        item("overdue", "2026-08-01", "2026-09-12"),
        item("future", "2026-09-14", "2026-09-20"),
        item("done", "2026-09-01", "2026-09-30", "done"),
        domain,
      ],
      "2026-09-13",
    );
    expect(groups.today.map((row) => row.id)).toEqual(["spans", "starts-today", "targets-today"]);
    expect(groups.overdue.map((row) => row.id)).toEqual(["overdue"]);
  });
});

describe("Kanban behavior", () => {
  it("excludes domains from cards and status changes", () => {
    const feature = item("feature", null, null);
    const domain = { ...item("domain", null, null), kind: "domain" as const };
    expect(kanbanItems([domain, feature])).toEqual([feature]);
    expect(canChangeKanbanStatus(domain, true, false)).toBe(false);
    expect(canChangeKanbanStatus(feature, true, false)).toBe(true);
    expect(canChangeKanbanStatus(feature, false, false)).toBe(false);
    expect(canChangeKanbanStatus(feature, true, true)).toBe(false);
  });
});

describe("deletion behavior", () => {
  it("confirms and removes the edited item even if background selection changes", async () => {
    const editing = item("editing", null, null);
    let selected = item("original-selection", null, null);
    const removed: PlanItem[] = [];
    await expect(
      deletePlanItem(
        editing,
        () => {
          selected = item("background-selection", null, null);
          return true;
        },
        async (value) => {
          removed.push(value);
        },
      ),
    ).resolves.toBe(true);
    expect(selected.id).toBe("background-selection");
    expect(removed).toEqual([editing]);
  });

  it("does not call the API after cancellation and preserves API failures", async () => {
    const editing = item("editing", null, null);
    let calls = 0;
    await expect(
      deletePlanItem(
        editing,
        () => false,
        async () => {
          calls += 1;
        },
      ),
    ).resolves.toBe(false);
    expect(calls).toBe(0);
    await expect(
      deletePlanItem(
        editing,
        () => true,
        async () => {
          throw new Error("delete failed");
        },
      ),
    ).rejects.toThrow("delete failed");
  });
});

describe("timelineTicks", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-10-05T00:00:00Z");

  it("uses genuinely different day, week, and month densities", () => {
    expect(timelineTicks(start, end, "day")).toHaveLength(35);
    expect(timelineTicks(start, end, "week")).toHaveLength(6);
    expect(timelineTicks(start, end, "month").map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-09-01",
      "2026-10-01",
    ]);
  });
});

describe("Editor", () => {
  it("invokes the deletion bound to the open editor", async () => {
    const feature = { ...item("edited", null, null), parent_id: "parent" };
    const remove = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <Editor
          item={feature}
          items={[feature]}
          close={() => undefined}
          save={async () => undefined}
          remove={remove}
          busy={false}
        />,
      ),
    );
    const deleteButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "삭제");
    await act(async () => deleteButton?.click());
    expect(remove).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("keeps cancel and delete non-submitting and exposes feature fields", () => {
    const feature = {
      ...item("feature", "2026-09-01", "2026-09-30"),
      kind: "feature" as const,
      parent_id: "parent",
      acceptance: "완료 조건",
      assignee: "담당자",
      blocked_reason: "막힘",
    };
    const html = renderToStaticMarkup(
      <Editor
        item={feature}
        items={[feature]}
        close={() => undefined}
        save={async () => undefined}
        remove={async () => undefined}
        busy={false}
      />,
    );
    expect(html).toContain('type="button"');
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html).toContain("시작일");
    expect(html).toContain("상태");
    expect(html).toContain("담당자");
    expect(html).toContain("막힌 이유");
    expect(html).toContain("완료 조건");
  });

  it("disables every mutation while busy and requires delete confirmation", () => {
    const feature = { ...item("feature", null, null), kind: "feature" as const, parent_id: "parent" };
    const html = renderToStaticMarkup(
      <Editor
        item={feature}
        items={[feature]}
        close={() => undefined}
        save={async () => undefined}
        remove={async () => undefined}
        busy
      />,
    );
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(confirmDeletion(feature, () => false)).toBe(false);
    expect(confirmDeletion(feature, () => true)).toBe(true);
  });
});
