// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeBootstrap } from "./ThemeBootstrap.js";
import type { ThemeContext } from "./theme-client.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const userOne = "01234567-89ab-cdef-0123-456789abcdef";
const userTwo = "11234567-89ab-cdef-0123-456789abcdef";
const scope = (userId: string, organizationId: string, workspaceId: string): ThemeContext => ({
  userId,
  organizationId,
  workspaceId,
});
const profile = (userId: string, base: "dark" | "light" | "high-contrast") => ({
  schemaVersion: "1.0" as const,
  userId: userId.replaceAll("-", ""),
  revision: 1,
  base,
  density: "compact" as const,
  overrides: {},
  reducedMotion: false,
});
const response = (value: object) =>
  new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mount(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
    root,
    render: (next: ReactNode) => act(() => root.render(next)),
    cleanup: () =>
      act(() => {
        root.unmount();
        host.remove();
      }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ThemeBootstrap context lifecycle", () => {
  it("preserves a local preview when the initial server response arrives late", async () => {
    const pending = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(pending.promise);
    const view = mount(
      <ThemeBootstrap scope={scope(userOne, "organization", "workspace")}>
        <div>surface</div>
      </ThemeBootstrap>,
    );
    const base =
      view.host.querySelector<HTMLSelectElement>('select[aria-label="기본 테마"]') ??
      Array.from(view.host.querySelectorAll("select")).find((select) => select.value === "dark");
    expect(base).toBeTruthy();
    act(() => {
      base!.value = "high-contrast";
      base!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.documentElement.dataset.afTheme).toBe("high-contrast");
    await act(async () => pending.resolve(response(profile(userOne, "light"))));
    expect(document.documentElement.dataset.afTheme).toBe("high-contrast");
    expect(base!.value).toBe("high-contrast");
    expect(view.host.textContent).toContain("서버 테마를 불러왔지만 미리보기는 아직 저장되지 않았습니다.");
    view.cleanup();
  });

  it("resets immediately and ignores stale responses across same-document scope switches", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const firstScope = scope(userOne, "organization-one", "workspace-one");
    const secondScope = scope(userTwo, "organization-two", "workspace-two");
    const view = mount(
      <ThemeBootstrap scope={firstScope}>
        <div>surface</div>
      </ThemeBootstrap>,
    );
    view.render(
      <ThemeBootstrap scope={secondScope}>
        <div>surface</div>
      </ThemeBootstrap>,
    );
    expect(document.documentElement.dataset.afTheme).toBe("dark");
    await act(async () => second.resolve(response(profile(userTwo, "light"))));
    expect(document.documentElement.dataset.afTheme).toBe("light");
    await act(async () => first.resolve(response(profile(userOne, "high-contrast"))));
    expect(document.documentElement.dataset.afTheme).toBe("light");
    view.cleanup();
  });

  it("continues with server authority when browser storage fails", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(profile(userOne, "high-contrast")));
    const view = mount(
      <ThemeBootstrap scope={scope(userOne, "organization", "workspace")}>
        <div>surface</div>
      </ThemeBootstrap>,
    );
    await act(async () => undefined);
    expect(document.documentElement.dataset.afTheme).toBe("high-contrast");
    expect(view.host.textContent).toContain("서버 테마를 적용했습니다.");
    view.cleanup();
  });
});
