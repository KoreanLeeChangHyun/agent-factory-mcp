// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountWorkbench } from "./account/AccountWorkbench.js";
import { AdminWorkbench } from "./admin/AdminWorkbench.js";
import {
  managementClient,
  type ConnectionRecord,
  type OrganizationOverview,
  type WorkspaceRecord,
} from "./management/management-client.js";
import { OrganizationWorkbench } from "./organization/OrganizationWorkbench.js";
import { WorkspaceWorkbench } from "./workspace/WorkspaceWorkbench.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const click = (element: Element) => act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const change = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
const button = (host: Element, label: string) =>
  Array.from(host.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label,
  )!;
const mount = (node: ReactNode) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
    render: (next: ReactNode) => act(() => root.render(next)),
    cleanup: () =>
      act(() => {
        root.unmount();
        host.remove();
      }),
  };
};
const flush = async () => act(async () => undefined);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  document.body.replaceChildren();
});

describe("native management consumers", () => {
  it("renders account context and loads owner-scoped security controls", async () => {
    vi.spyOn(managementClient, "workspaces").mockResolvedValue([
      { id: "workspace", name: "작업공간" } as WorkspaceRecord,
    ]);
    vi.spyOn(managementClient, "sessions")
      .mockResolvedValueOnce([{ id: "session", user_agent: "Browser", expires_at: "later", revoked_at: null }])
      .mockResolvedValue([
        { id: "session", user_agent: "Browser", expires_at: "later", revoked_at: "2026-09-13T05:00:00Z" },
      ]);
    vi.spyOn(managementClient, "tokens")
      .mockResolvedValueOnce([{ id: "token", name: "CLI", revoked_at: null }])
      .mockResolvedValueOnce([{ id: "token", name: "CLI", revoked_at: null }])
      .mockResolvedValue([{ id: "token", name: "CLI", revoked_at: "2026-09-13T05:05:00Z" }]);
    const revokeSession = vi.spyOn(managementClient, "revokeSession").mockResolvedValue(undefined);
    const revokeToken = vi.spyOn(managementClient, "revokeToken").mockResolvedValue(undefined);
    const view = mount(
      <AccountWorkbench
        user={{ id: "user", email: "user@example.com", display_name: "사용자", is_platform_admin: false }}
        organization={{ id: "organization", name: "조직", slug: "org", is_personal: false }}
        workspaceId="workspace"
      />,
    );
    await flush();
    expect(view.host.textContent).toContain("조직");
    expect(view.host.textContent).toContain("작업공간");
    click(button(view.host, "보안"));
    await flush();
    expect(view.host.textContent).toContain("Browser");
    expect(view.host.textContent).toContain("CLI");
    click(button(view.host, "세션 해제"));
    await flush();
    expect(revokeSession).toHaveBeenCalledWith("session");
    expect(view.host.textContent).not.toContain("Browser");
    expect(Array.from(view.host.querySelectorAll("button")).filter((item) => item.textContent === "세션 해제")).toEqual(
      [],
    );
    click(button(view.host, "폐기"));
    await flush();
    expect(revokeToken).toHaveBeenCalledWith("token");
    expect(view.host.textContent).not.toContain("CLI");
    expect(Array.from(view.host.querySelectorAll("button")).filter((item) => item.textContent === "폐기")).toEqual([]);
    click(button(view.host, "테마"));
    expect(view.host.textContent).toContain("개인 테마를 불러오는 중입니다.");
    view.cleanup();
  });

  it("renders scoped organization role and complete team removal controls", async () => {
    const overview: OrganizationOverview = {
      id: "organization",
      name: "조직",
      slug: "org",
      revision: 1,
      is_personal: false,
      permissions: [
        "team.read",
        "team.create",
        "team.update",
        "team.delete",
        "team.manage_members",
        "member.read",
        "member.invite",
        "role.read",
        "role.create",
      ],
    };
    vi.spyOn(managementClient, "organization").mockResolvedValue(overview);
    const organizationResource = async <T,>(_id: string, suffix: string): Promise<T> => {
      if (suffix === "teams")
        return [
          {
            id: "team",
            name: "팀",
            description: "",
            members: ["user"],
            workspaces: [{ workspace_id: "workspace", role_id: "role" }],
          },
        ] as unknown as T;
      if (suffix === "members")
        return [
          {
            user_id: "user",
            email: "member@example.com",
            name: "팀원",
            role_id: "organization-role",
            role_name: "organization_member",
            status: "active",
            joined_at: "2026-09-13T00:00:00Z",
          },
        ] as unknown as T;
      if (suffix === "workspace-options") return [{ id: "workspace", name: "작업공간" }] as unknown as T;
      if (suffix === "roles")
        return [
          { id: "organization-role", name: "구성원", scope: "organization" },
          { id: "role", name: "뷰어", scope: "workspace" },
        ] as unknown as T;
      if (suffix === "permission-catalog")
        return [{ key: "test.execute", label: "테스트 실행", available: false }] as unknown as T;
      return [] as unknown as T;
    };
    vi.spyOn(managementClient, "organizationResource").mockImplementation(organizationResource);
    const view = mount(
      <OrganizationWorkbench
        organizations={[overview]}
        selectedId="organization"
        onSelect={() => undefined}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "팀"));
    await flush();
    click(button(view.host, "편집"));
    expect(view.host.querySelector('option[value="user"]')?.textContent).toBe("팀원");
    expect(button(view.host, "팀원 제거")).toBeTruthy();
    expect(button(view.host, "작업공간 부여 해제")).toBeTruthy();
    click(button(view.host, "대화상자 닫기"));
    click(button(view.host, "구성원"));
    await flush();
    click(button(view.host, "초대"));
    const invitationDialog = view.host.querySelector('[role="dialog"]')!;
    expect(invitationDialog.querySelector('option[value="organization-role"]')?.textContent).toBe("구성원");
    expect(invitationDialog.querySelector('option[value="workspace"]')?.textContent).toBe("작업공간");
    expect(invitationDialog.querySelector('option[value="role"]')?.textContent).toBe("뷰어");
    click(button(invitationDialog, "대화상자 닫기"));
    click(button(view.host, "설정 · 역할 및 권한"));
    await flush();
    click(button(view.host, "역할 만들기"));
    expect(view.host.querySelector('select option[value="workspace"]')).not.toBeNull();
    expect(view.host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
    view.cleanup();
  });

  it.each([
    {
      label: "organization owner",
      isOwner: true,
      organizationPermissions: ["member.read", "role.read"],
      workspacePermissions: [] as string[],
    },
    {
      label: "authorized Workspace manager",
      isOwner: false,
      organizationPermissions: ["member.read", "role.read", "role.assign"],
      workspacePermissions: ["workspace.manage_members"],
    },
  ])(
    "enables direct member assignment for an $label",
    async ({ isOwner, organizationPermissions, workspacePermissions }) => {
      const overview: OrganizationOverview = {
        id: "organization",
        name: "조직",
        slug: "org",
        revision: 1,
        is_personal: false,
        is_owner: isOwner,
        permissions: organizationPermissions,
      };
      vi.spyOn(managementClient, "organization").mockResolvedValue(overview);
      const organizationResource = async <T,>(_id: string, suffix: string): Promise<T> => {
        if (suffix === "members")
          return [
            {
              user_id: "user",
              email: "member@example.com",
              name: "팀원",
              role_id: "organization-role",
              role_name: "organization_member",
              status: "active",
              joined_at: "2026-09-13T00:00:00Z",
            },
          ] as unknown as T;
        if (suffix === "workspace-options")
          return [{ id: "workspace", name: "작업공간", permissions: workspacePermissions }] as unknown as T;
        if (suffix === "roles") return [{ id: "role", name: "뷰어", scope: "workspace" }] as unknown as T;
        if (suffix === "members/user")
          return {
            user_id: "user",
            email: "member@example.com",
            name: "팀원",
            role_id: "organization-role",
            organization_sources: [],
            teams: [],
            workspaces: [],
          } as unknown as T;
        return [] as unknown as T;
      };
      vi.spyOn(managementClient, "organizationResource").mockImplementation(organizationResource);
      const view = mount(
        <OrganizationWorkbench
          organizations={[overview]}
          selectedId="organization"
          onSelect={() => undefined}
          onCreated={() => undefined}
        />,
      );
      await flush();
      click(button(view.host, "구성원"));
      await flush();
      click(button(view.host, "상세"));
      await flush();
      expect(button(view.host, "직접 배정").hasAttribute("disabled")).toBe(false);
      view.cleanup();
    },
  );

  it("preserves a dialog opened while a member row mutation is pending", async () => {
    const overview: OrganizationOverview = {
      id: "organization",
      name: "조직",
      slug: "org",
      revision: 1,
      is_personal: false,
      permissions: ["member.read", "member.suspend", "organization.transfer"],
    };
    vi.spyOn(managementClient, "organization").mockResolvedValue(overview);
    vi.spyOn(managementClient, "organizationResource").mockImplementation(async (_id, suffix) =>
      suffix === "members"
        ? [
            {
              user_id: "user",
              email: "member@example.com",
              name: "팀원",
              role_id: "organization-role",
              role_name: "organization_member",
              status: "active",
              joined_at: "2026-09-13T00:00:00Z",
            },
          ]
        : [],
    );
    let resolveMutation!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveMutation = resolve;
    });
    const delayedMutation = <T,>(): Promise<T> => pending as Promise<T>;
    vi.spyOn(managementClient, "mutateOrganization").mockImplementation(delayedMutation);
    const view = mount(
      <OrganizationWorkbench
        organizations={[overview]}
        selectedId="organization"
        onSelect={() => undefined}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "구성원"));
    await flush();
    click(button(view.host, "정지"));
    click(button(view.host, "설정"));
    await flush();
    click(button(view.host, "소유권 이전"));
    await act(async () => resolveMutation({}));
    expect(view.host.querySelector('[role="dialog"]')?.textContent).toContain("소유권 이전");
    view.cleanup();
  });

  it("refreshes the organization overview projection after a successful mutation", async () => {
    const overview: OrganizationOverview = {
      id: "organization",
      name: "기존 조직",
      slug: "org",
      revision: 1,
      is_personal: false,
      permissions: ["organization.update"],
    };
    const refreshed: OrganizationOverview = {
      ...overview,
      name: "새 조직",
      revision: 2,
      permissions: ["organization.update", "organization.transfer"],
    };
    const organization = vi
      .spyOn(managementClient, "organization")
      .mockResolvedValueOnce(overview)
      .mockResolvedValueOnce(refreshed);
    vi.spyOn(managementClient, "organizationResource").mockResolvedValue([]);
    vi.spyOn(managementClient, "mutateOrganization").mockResolvedValue({});
    const onSelect = vi.fn();
    const view = mount(
      <OrganizationWorkbench
        organizations={[overview]}
        selectedId="organization"
        onSelect={onSelect}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "설정"));
    await flush();
    click(button(view.host, "조직 수정"));
    const dialog = view.host.querySelector('[role="dialog"]')!;
    change(dialog.querySelector<HTMLInputElement>("input")!, "새 조직");
    act(() =>
      dialog.querySelector("form")!.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    await flush();
    expect(organization).toHaveBeenCalledTimes(2);
    expect(view.host.querySelector(".af-native-panel-header h1")?.textContent).toBe("새 조직");
    expect(button(view.host, "소유권 이전").hasAttribute("disabled")).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    view.cleanup();
  });

  it("clears retained member detail while refreshed detail is loading after a mutation", async () => {
    const overview: OrganizationOverview = {
      id: "organization",
      name: "조직",
      slug: "org",
      revision: 1,
      is_personal: false,
      permissions: ["member.read", "member.suspend"],
    };
    vi.spyOn(managementClient, "organization").mockResolvedValue(overview);
    let resolveDetail!: (value: Record<string, unknown>) => void;
    const refreshedDetail = new Promise<Record<string, unknown>>((resolve) => {
      resolveDetail = resolve;
    });
    let detailRequests = 0;
    const organizationResource = async <T,>(_id: string, suffix: string): Promise<T> => {
      if (suffix === "members")
        return [
          {
            user_id: "user",
            email: "member@example.com",
            name: "팀원",
            role_id: "organization-role",
            role_name: "organization_member",
            status: "active",
            joined_at: "2026-09-13T00:00:00Z",
          },
        ] as unknown as T;
      if (suffix === "members/user") {
        detailRequests += 1;
        if (detailRequests === 1)
          return {
            user_id: "user",
            email: "member@example.com",
            name: "이전 상세",
            role_id: "organization-role",
            organization_sources: [],
            teams: [],
            workspaces: [],
          } as unknown as T;
        return (await refreshedDetail) as T;
      }
      return [] as unknown as T;
    };
    vi.spyOn(managementClient, "organizationResource").mockImplementation(organizationResource);
    vi.spyOn(managementClient, "mutateOrganization").mockResolvedValue({});
    const view = mount(
      <OrganizationWorkbench
        organizations={[overview]}
        selectedId="organization"
        onSelect={() => undefined}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "구성원"));
    await flush();
    click(button(view.host, "상세"));
    await flush();
    expect(view.host.querySelector(".af-native-detail")?.textContent).toContain("이전 상세");
    click(button(view.host, "정지"));
    await flush();
    click(button(view.host, "상세"));
    expect(view.host.querySelector(".af-native-detail")).toBeNull();
    await act(async () =>
      resolveDetail({
        user_id: "user",
        email: "member@example.com",
        name: "새 상세",
        role_id: "organization-role",
        organization_sources: [],
        teams: [],
        workspaces: [],
      }),
    );
    expect(view.host.querySelector(".af-native-detail")?.textContent).toContain("새 상세");
    view.cleanup();
  });

  it("does not fetch protected organization collections without read permission", async () => {
    vi.spyOn(managementClient, "organization").mockResolvedValue({
      id: "organization",
      name: "Restricted",
      slug: "restricted",
      revision: 1,
      is_personal: false,
      permissions: [],
    });
    const resource = vi.spyOn(managementClient, "organizationResource").mockResolvedValue([]);
    const view = mount(
      <OrganizationWorkbench
        organizations={[{ id: "organization", name: "Restricted", slug: "restricted", is_personal: false }]}
        selectedId="organization"
        onSelect={() => undefined}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "팀"));
    await flush();
    expect(resource).not.toHaveBeenCalledWith("organization", "teams", expect.anything());
    expect(button(view.host, "팀 만들기").hasAttribute("disabled")).toBe(true);
    view.cleanup();
  });

  it("keeps personal-organization invitation and deletion restrictions disabled without protected invitation reads", async () => {
    const personal: OrganizationOverview = {
      id: "personal",
      name: "개인 조직",
      slug: "personal",
      revision: 1,
      is_personal: true,
      permissions: ["member.invite", "organization.delete"],
    };
    vi.spyOn(managementClient, "organization").mockResolvedValue(personal);
    const resource = vi.spyOn(managementClient, "organizationResource").mockResolvedValue([]);
    const view = mount(
      <OrganizationWorkbench
        organizations={[personal]}
        selectedId="personal"
        onSelect={() => undefined}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "구성원"));
    await flush();
    expect(button(view.host, "초대").hasAttribute("disabled")).toBe(true);
    click(button(view.host, "설정"));
    await flush();
    expect(button(view.host, "조직 삭제").hasAttribute("disabled")).toBe(true);
    expect(resource).not.toHaveBeenCalledWith("personal", "invitations", expect.anything());
    view.cleanup();
  });

  it("retains owner-transfer and typed-deletion inputs when delegation and last-owner mutations fail", async () => {
    const overview: OrganizationOverview = {
      id: "organization",
      name: "보존 조직",
      slug: "retained",
      revision: 1,
      is_personal: false,
      permissions: ["organization.transfer", "organization.delete"],
    };
    vi.spyOn(managementClient, "organization").mockResolvedValue(overview);
    vi.spyOn(managementClient, "organizationResource").mockResolvedValue([]);
    const mutate = vi
      .spyOn(managementClient, "mutateOrganization")
      .mockRejectedValueOnce(new Error("delegation denied"))
      .mockRejectedValueOnce(new Error("last owner"));
    const view = mount(
      <OrganizationWorkbench
        organizations={[overview]}
        selectedId="organization"
        onSelect={() => undefined}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "설정"));
    await flush();
    click(button(view.host, "소유권 이전"));
    const transferDialog = view.host.querySelector('[role="dialog"]')!;
    const owner = transferDialog.querySelector<HTMLInputElement>("input")!;
    change(owner, "target-user");
    act(() =>
      transferDialog
        .querySelector("form")!
        .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    await flush();
    expect(owner.value).toBe("target-user");
    expect(transferDialog.textContent).toContain("delegation denied");
    expect(mutate).toHaveBeenCalledWith(
      "organization",
      "transfer",
      "POST",
      { user_id: "target-user" },
      expect.any(AbortSignal),
    );
    click(button(view.host, "대화상자 닫기"));

    click(button(view.host, "조직 삭제"));
    const deleteDialog = view.host.querySelector('[role="dialog"]')!;
    const confirmation = deleteDialog.querySelector<HTMLInputElement>("input")!;
    change(confirmation, "보존 조직");
    act(() =>
      deleteDialog.querySelector("form")!.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    await flush();
    expect(confirmation.value).toBe("보존 조직");
    expect(deleteDialog.textContent).toContain("last owner");
    view.cleanup();
  });

  it("guards duplicate organization submissions and discards a closed dialog completion", async () => {
    const overview: OrganizationOverview = {
      id: "organization",
      name: "조직",
      slug: "org",
      revision: 1,
      is_personal: false,
      permissions: ["organization.update"],
    };
    vi.spyOn(managementClient, "organization").mockResolvedValue(overview);
    vi.spyOn(managementClient, "organizationResource").mockResolvedValue([]);
    let resolveMutation!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveMutation = resolve;
    });
    let mutationSignal: AbortSignal | undefined;
    const delayedMutation = <T,>(
      _organizationId: string,
      _suffix: string,
      _method: string,
      _input?: unknown,
      signal?: AbortSignal,
    ): Promise<T> => {
      mutationSignal = signal;
      return pending as unknown as Promise<T>;
    };
    const mutate = vi.spyOn(managementClient, "mutateOrganization").mockImplementation(delayedMutation);
    const onSelect = vi.fn();
    const view = mount(
      <OrganizationWorkbench
        organizations={[overview]}
        selectedId="organization"
        onSelect={onSelect}
        onCreated={() => undefined}
      />,
    );
    await flush();
    click(button(view.host, "설정"));
    await flush();
    click(button(view.host, "조직 수정"));
    const form = view.host.querySelector<HTMLFormElement>('[role="dialog"] form')!;
    act(() => {
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    click(button(view.host, "대화상자 닫기"));
    expect(mutationSignal?.aborted).toBe(true);
    await act(async () => resolveMutation({}));
    expect(onSelect).not.toHaveBeenCalled();
    view.cleanup();
  });

  it("discards an organization mutation completion after the selected tenant changes", async () => {
    const first: OrganizationOverview = {
      id: "first",
      name: "첫 조직",
      slug: "first",
      revision: 1,
      is_personal: false,
      permissions: ["organization.update"],
    };
    const second = { ...first, id: "second", name: "둘째 조직", slug: "second" };
    vi.spyOn(managementClient, "organization").mockImplementation(async (id) => (id === "first" ? first : second));
    vi.spyOn(managementClient, "organizationResource").mockResolvedValue([]);
    let resolveMutation!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveMutation = resolve;
    });
    let mutationSignal: AbortSignal | undefined;
    const delayedMutation = <T,>(
      _organizationId: string,
      _suffix: string,
      _method: string,
      _input?: unknown,
      signal?: AbortSignal,
    ): Promise<T> => {
      mutationSignal = signal;
      return pending as unknown as Promise<T>;
    };
    vi.spyOn(managementClient, "mutateOrganization").mockImplementation(delayedMutation);
    const onRefresh = vi.fn();
    const common = {
      organizations: [first, second],
      onSelect: onRefresh,
      onCreated: () => undefined,
    };
    const view = mount(<OrganizationWorkbench {...common} selectedId="first" />);
    await flush();
    click(button(view.host, "설정"));
    await flush();
    click(button(view.host, "조직 수정"));
    act(() =>
      view.host
        .querySelector<HTMLFormElement>('[role="dialog"] form')!
        .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    view.render(<OrganizationWorkbench {...common} selectedId="second" />);
    await flush();
    expect(mutationSignal?.aborted).toBe(true);
    await act(async () => resolveMutation({}));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(view.host.textContent).toContain("둘째 조직");
    view.cleanup();
  });

  it("renders validated administrator feature flags on the shared table", async () => {
    vi.spyOn(managementClient, "admin").mockImplementation(async (suffix) =>
      suffix === "feature-flags"
        ? [{ key: "react-workbench", description: "롤아웃", rules: {}, is_enabled: true }]
        : { status: "ok" },
    );
    const mutate = vi.spyOn(managementClient, "mutateAdmin").mockResolvedValue({});
    const view = mount(<AdminWorkbench />);
    await flush();
    click(button(view.host, "기능 플래그"));
    await flush();
    expect(view.host.querySelector("table.af-table")).not.toBeNull();
    click(button(view.host, "편집"));
    const rules = view.host.querySelector<HTMLTextAreaElement>("textarea")!;
    change(rules, "[]");
    act(() => rules.form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })));
    expect(view.host.textContent).toContain("JSON 객체");
    change(rules, '{"workspaceIds":["workspace"]}');
    act(() => rules.form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })));
    await flush();
    expect(mutate).toHaveBeenCalledWith(
      "feature-flags/react-workbench",
      "PUT",
      expect.objectContaining({ is_enabled: true }),
    );
    view.cleanup();
  });

  it("does not refresh an obsolete administrator view after a delayed mutation", async () => {
    vi.spyOn(managementClient, "admin").mockImplementation(async (suffix) => {
      if (suffix === "jobs") return [{ id: "job", task_type: "지연 Job", status: "failed" }];
      if (suffix === "integrations") return [{ id: "integration", name: "Stage 10 connection", status: "healthy" }];
      return { status: "ok" };
    });
    let resolveMutation!: (value: unknown) => void;
    const pendingMutation = new Promise<unknown>((resolve) => {
      resolveMutation = resolve;
    });
    const delayedMutation = <T,>(): Promise<T> => pendingMutation as Promise<T>;
    const mutate = vi.spyOn(managementClient, "mutateAdmin").mockImplementation(delayedMutation);
    const view = mount(<AdminWorkbench />);
    await flush();
    click(button(view.host, "Jobs"));
    await flush();
    click(button(view.host, "재시도"));
    expect(mutate).toHaveBeenCalledWith("jobs/job/retry", "POST", undefined);
    expect(view.host.textContent).toContain("관리 작업을 처리하는 중입니다.");

    click(button(view.host, "연동 상태"));
    await flush();
    expect(view.host.textContent).toContain("Stage 10 connection");
    const integrationAction = button(view.host, "연동 해제");
    await act(async () => resolveMutation({}));
    await flush();
    expect(view.host.textContent).toContain("Stage 10 connection");
    expect(button(view.host, "연동 해제")).toBe(integrationAction);
    view.cleanup();
  });

  it("renders administrator mutation failures while keeping the action available for retry", async () => {
    vi.spyOn(managementClient, "admin").mockImplementation(async (suffix) =>
      suffix === "jobs" ? [{ id: "job", task_type: "실패 Job", status: "failed" }] : { status: "ok" },
    );
    vi.spyOn(managementClient, "mutateAdmin").mockRejectedValue(new Error("Job 재시도에 실패했습니다."));
    const view = mount(<AdminWorkbench />);
    await flush();
    click(button(view.host, "Jobs"));
    await flush();
    click(button(view.host, "재시도"));
    await flush();
    expect(view.host.querySelector('[role="alert"]')?.textContent).toContain("Job 재시도에 실패했습니다.");
    expect(button(view.host, "재시도")).toBeTruthy();
    view.cleanup();
  });

  it("operates administrator status, ownership, Job, and integration controls through rendered confirmations", async () => {
    vi.spyOn(managementClient, "admin").mockImplementation(async (suffix) => {
      if (suffix === "users")
        return [
          { id: "administrator", display_name: "관리자", status: "active", is_platform_admin: true },
          { id: "user", display_name: "사용자", status: "active", is_platform_admin: false },
        ];
      if (suffix === "jobs") return [{ id: "job", task_type: "동기화", status: "failed" }];
      if (suffix === "integrations") return [{ id: "integration", name: "연동", status: "healthy" }];
      if (suffix === "organizations") return [{ id: "organization", name: "조직", status: "active" }];
      if (suffix === "workspaces") return [{ id: "workspace", name: "작업공간", status: "active" }];
      return { status: "ok" };
    });
    const mutate = vi.spyOn(managementClient, "mutateAdmin").mockResolvedValue({});
    const view = mount(<AdminWorkbench />);
    await flush();
    click(button(view.host, "사용자"));
    await flush();
    const userRows = view.host.querySelectorAll("tbody tr");
    expect(button(userRows[0], "정지").hasAttribute("disabled")).toBe(true);
    click(button(userRows[1], "정지"));
    click(button(view.host.querySelector('[role="dialog"]')!, "확인"));
    await flush();
    expect(mutate).toHaveBeenCalledWith("users/user/status", "PUT", { status: "suspended" });

    click(button(view.host, "Jobs"));
    await flush();
    click(button(view.host, "재시도"));
    await flush();
    expect(mutate).toHaveBeenCalledWith("jobs/job/retry", "POST", undefined);

    click(button(view.host, "연동 상태"));
    await flush();
    click(button(view.host, "연동 해제"));
    click(button(view.host.querySelector('[role="dialog"]')!, "취소"));
    expect(mutate).not.toHaveBeenCalledWith("integrations/integration", "DELETE", undefined);
    click(button(view.host, "연동 해제"));
    click(button(view.host.querySelector('[role="dialog"]')!, "확인"));
    await flush();
    expect(mutate).toHaveBeenCalledWith("integrations/integration", "DELETE", undefined);

    click(button(view.host, "조직 및 작업공간"));
    await flush();
    click(button(view.host, "소유자 추가"));
    const ownerDialog = view.host.querySelector('[role="dialog"]')!;
    change(ownerDialog.querySelectorAll<HTMLInputElement>("input")[0], "organization");
    change(ownerDialog.querySelectorAll<HTMLInputElement>("input")[1], "user");
    act(() =>
      ownerDialog.querySelector("form")!.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    await flush();
    expect(mutate).toHaveBeenCalledWith("ownership", "POST", {
      scope: "organization",
      resource_id: "organization",
      user_id: "user",
    });
    view.cleanup();
  });

  it("isolates Workspace token selection, retries evidence, and purges a revoked connection", async () => {
    const workspace = {
      id: "workspace",
      organization_id: "organization",
      name: "작업공간",
      slug: "workspace",
      status: "active",
      revision: 1,
      created_at: "",
      updated_at: "",
    };
    vi.spyOn(managementClient, "workspaces").mockResolvedValue([workspace]);
    vi.spyOn(managementClient, "groups").mockResolvedValue([]);
    vi.spyOn(managementClient, "recent").mockResolvedValue([]);
    vi.spyOn(managementClient, "organization").mockResolvedValue({
      id: "organization",
      name: "조직",
      slug: "org",
      revision: 1,
      is_personal: false,
      permissions: [],
    });
    const pendingRows: ConnectionRecord[] = [{ id: "token", name: "토큰", state: "active" }];
    const evidenceRows: ConnectionRecord[] = [{ ...pendingRows[0]!, last_seen_at: "2026-09-13T00:00:00Z" }];
    const revokedRows: ConnectionRecord[] = [{ ...pendingRows[0]!, state: "reauth_required", reason: "revoked" }];
    let resolveCheck!: (value: ConnectionRecord[]) => void;
    const check = new Promise<ConnectionRecord[]>((resolve) => {
      resolveCheck = resolve;
    });
    const connections = vi
      .spyOn(managementClient, "connections")
      .mockResolvedValueOnce(pendingRows)
      .mockReturnValueOnce(check)
      .mockResolvedValue(evidenceRows);
    const revokeConnection = vi.spyOn(managementClient, "revokeConnection").mockResolvedValue(undefined);
    vi.spyOn(managementClient, "updateWorkspace").mockRejectedValue(new Error("revision conflict"));
    localStorage.setItem("agent-factory:mcp-token:v1:user:organization:workspace", "token");
    const view = mount(
      <WorkspaceWorkbench
        userId="user"
        organizationId="organization"
        personal={false}
        selectedId="workspace"
        permissions={["workspace.update", "token.read"]}
        onSelect={() => undefined}
      />,
    );
    await flush();
    const row = view.host.querySelector(".af-native-workspace-row[aria-current='page']")!;
    act(() => row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
    expect(view.host.textContent).toContain("이름 변경");
    const renameInput = view.host.querySelector<HTMLInputElement>('[role="dialog"] input')!;
    change(renameInput, "보존된 이름");
    click(button(view.host.querySelector('[role="dialog"]')!, "저장"));
    await flush();
    expect(renameInput.value).toBe("보존된 이름");
    expect(view.host.textContent).toContain("revision conflict");
    click(button(view.host, "대화상자 닫기"));
    click(button(view.host, "MCP 연결"));
    await flush();
    click(button(view.host, "연결 확인"));
    expect(view.host.textContent).toContain("확인 중…");
    await act(async () => resolveCheck(pendingRows));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 120)));
    expect(view.host.textContent).toContain("MCP 연결됨");
    connections.mockResolvedValueOnce(revokedRows);
    click(button(view.host, "폐기"));
    await flush();
    expect(revokeConnection).toHaveBeenCalledWith("organization", "workspace", "token", false);
    expect(button(view.host, "영구 삭제")).toBeTruthy();
    connections.mockResolvedValueOnce([]);
    click(button(view.host, "영구 삭제"));
    await flush();
    expect(revokeConnection).toHaveBeenCalledWith("organization", "workspace", "token", true);
    expect(button(view.host, "영구 삭제")).toBeUndefined();
    view.cleanup();
  });
});
