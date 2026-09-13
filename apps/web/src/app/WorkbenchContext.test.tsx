// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedThemeRoot } from "../AuthenticatedThemeRoot.js";
import { WorkbenchContextProvider, useWorkbenchContext } from "./WorkbenchContext.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const firstUser = "01234567-89ab-cdef-0123-456789abcdef";
const secondUser = "11234567-89ab-cdef-0123-456789abcdef";
const profile = (userId: string, base: "dark" | "light" | "high-contrast") => ({
  schemaVersion: "1.0",
  userId: userId.replaceAll("-", ""),
  revision: 1,
  base,
  density: "compact",
  overrides: {},
  reducedMotion: false,
});
const json = (value: object) =>
  new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

function Controls() {
  const { refreshIdentity, selectContext } = useWorkbenchContext();
  return (
    <>
      <button onClick={() => selectContext({ organizationId: "organization-two", workspaceId: "workspace-two" })}>
        컨텍스트 전환
      </button>
      <button onClick={refreshIdentity}>계정 갱신</button>
    </>
  );
}

function mount(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
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

describe("production Workbench context composition", () => {
  it("resets before organization, Workspace, and account scopes resolve", async () => {
    let userId = firstUser;
    let delayTheme = false;
    let resolveTheme: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me"))
        return Promise.resolve(
          json({ user: { id: userId, email: "user@example.test", display_name: "User", is_platform_admin: false } }),
        );
      if (url.endsWith("/api/account/organizations"))
        return Promise.resolve(
          json([
            { id: "organization-one", name: "One", slug: "one", is_personal: false },
            { id: "organization-two", name: "Two", slug: "two", is_personal: false },
          ]),
        );
      if (url.includes("/api/organizations/") && url.endsWith("/workspaces"))
        return Promise.resolve(json([{ id: "workspace-one" }, { id: "workspace-two" }]));
      if (delayTheme)
        return new Promise<Response>((resolve) => {
          resolveTheme = resolve;
        });
      return Promise.resolve(json(profile(userId, "high-contrast")));
    });
    const view = mount(
      <WorkbenchContextProvider initialSelection={{ organizationId: "organization-one", workspaceId: "workspace-one" }}>
        <AuthenticatedThemeRoot>
          <Controls />
        </AuthenticatedThemeRoot>
      </WorkbenchContextProvider>,
    );
    await act(async () => undefined);
    expect(document.documentElement.dataset.afTheme).toBe("high-contrast");

    delayTheme = true;
    act(() => view.host.querySelector<HTMLButtonElement>("button")?.click());
    expect(document.documentElement.dataset.afTheme).toBe("dark");
    await act(async () => resolveTheme?.(json(profile(firstUser, "light"))));
    expect(document.documentElement.dataset.afTheme).toBe("light");

    userId = secondUser;
    delayTheme = true;
    act(() => view.host.querySelectorAll<HTMLButtonElement>("button")[1]?.click());
    expect(document.documentElement.dataset.afTheme).toBe("dark");
    await act(async () => undefined);
    await act(async () => resolveTheme?.(json(profile(secondUser, "high-contrast"))));
    expect(document.documentElement.dataset.afTheme).toBe("high-contrast");
    view.cleanup();
  });

  it("clears an undiscovered Workspace deep link before publishing the authenticated context", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me"))
        return Promise.resolve(
          json({ user: { id: firstUser, email: "user@example.com", display_name: "User", is_platform_admin: false } }),
        );
      if (url.endsWith("/api/account/organizations"))
        return Promise.resolve(json([{ id: "organization-one", name: "One", slug: "one", is_personal: false }]));
      if (url.endsWith("/workspaces")) return Promise.resolve(json([{ id: "workspace-visible" }]));
      return Promise.resolve(json(profile(firstUser, "dark")));
    });
    function Selection() {
      const { selection, loading } = useWorkbenchContext();
      return <output>{loading ? "loading" : `${selection.organizationId}:${selection.workspaceId}`}</output>;
    }
    const view = mount(
      <WorkbenchContextProvider
        initialSelection={{ organizationId: "organization-one", workspaceId: "workspace-not-authorized" }}
      >
        <Selection />
      </WorkbenchContextProvider>,
    );
    await act(async () => undefined);
    await act(async () => undefined);
    expect(view.host.textContent).toContain("organization-one:null");
    const historyUrl = new URL(window.location.href);
    historyUrl.searchParams.set("organization", "organization-one");
    historyUrl.searchParams.set("workspace", "workspace-stale-history");
    history.pushState({}, "", historyUrl);
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await act(async () => undefined);
    expect(view.host.textContent).toContain("organization-one:null");
    view.cleanup();
  });
});
