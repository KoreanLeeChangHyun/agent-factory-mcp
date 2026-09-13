import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  instantiateAsset,
  ShellResizeHandle,
  StateView,
  WorkbenchFrame,
  WorkbenchPanel,
  WorkbenchSidebar,
  WorkbenchTaskList,
} from "@agent-factory/design-system";
import { WorkbenchRenderer, type RuntimeRecord } from "@agent-factory/workbench-runtime";
import { apiRequest } from "../api-client.js";
import { legacyWorkspacePath } from "../api-path.js";
import { useWorkbenchContext } from "../app/WorkbenchContext.js";
import { loadAuthorizedRegistry, nativeStandards, type RegisteredWorkbench } from "../registry/WorkbenchRegistry.js";
import { AccountWorkbench } from "../standard/account/index.js";
import { AdminWorkbench } from "../standard/admin/index.js";
import { AgentsWorkbench } from "../standard/agents/index.js";
import { ConnectionsWorkbench } from "../standard/connections/index.js";
import { DocumentsWorkbench } from "../standard/documents/index.js";
import { createWorkbenchBindingClient, workbenchOperations } from "../app/workbench-bindings.js";
import { OrganizationWorkbench } from "../standard/organization/index.js";
import { ReportingWorkbench } from "../standard/reporting/index.js";
import { ScheduleWorkbench } from "../standard/schedule/index.js";
import { WorkspaceWorkbench, type WorkspaceRecord } from "../standard/workspace/index.js";

interface SelectionProjection {
  mode: "legacy" | "react";
  version: 1;
  permissions: string[];
}
function taskIcon(workbench: RegisteredWorkbench, selected: boolean): ReactNode {
  try {
    return instantiateAsset(workbench.icon, { label: workbench.title, selected });
  } catch {
    return <span aria-hidden="true">□</span>;
  }
}

export function WorkbenchShell() {
  const context = useWorkbenchContext();
  const { user, organizations, selection } = context;
  const [entries, setEntries] = useState<RegisteredWorkbench[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(() =>
    typeof window === "undefined"
      ? "organization"
      : (new URLSearchParams(window.location.search).get("task") ?? "organization"),
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(268);
  const [message, setMessage] = useState("");
  const [customerState, setCustomerState] = useState<RuntimeRecord>({ selection: { documentId: null } });
  const generation = useRef(0);
  const organizationId = selection.organizationId;
  const workspaceId = selection.workspaceId;
  const scopeKey = user ? `${user.id}:${organizationId ?? "none"}:${workspaceId ?? "none"}` : "unauthenticated";
  const taskPreferenceKey = (taskId: string) => `agent-factory:shell:v3:${scopeKey}:${taskId}`;
  const restoreTaskPreference = (taskId: string) => {
    try {
      return JSON.parse(localStorage.getItem(taskPreferenceKey(taskId)) ?? "{}") as {
        sidebarOpen?: boolean;
        sidebarWidth?: number;
      };
    } catch {
      return {};
    }
  };
  const prepareLegacyRollback = () => {
    if (!user || !organizationId || !workspaceId) return;
    const legacyActivity =
      ({ reporting: "logs", connections: "integrations", administration: "admin" } as Record<string, string>)[
        selectedId
      ] ?? selectedId;
    try {
      localStorage.setItem(`agentFactoryOrganizationId:${user.id}`, organizationId);
    } catch {
      /* optional legacy organization handoff */
    }
    try {
      localStorage.setItem(
        `agentFactorySelection:${user.id}:${organizationId}`,
        JSON.stringify({ workspaceId, mode: "workspace", activity: legacyActivity }),
      );
    } catch {
      /* optional legacy view handoff */
    }
    try {
      sessionStorage.setItem(
        `agent-factory:workbench-rollback:v1:${user.id}:${organizationId}:${workspaceId}`,
        "legacy-once",
      );
    } catch {
      /* optional one-time rollback marker */
    }
  };

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    if (!user) {
      setEntries([]);
      return () => controller.abort();
    }
    const available = nativeStandards.filter((item) => item.native !== "administration" || user.is_platform_admin);
    setEntries(available);
    if (!organizationId || !workspaceId) {
      const allowed = new Set(available.map((item) => item.id));
      if (
        !allowed.has(selectedId) ||
        ["schedule", "agents", "documents", "reporting", "connections"].includes(selectedId)
      )
        setSelectedId(organizationId ? "workspaces" : "organization");
      setPermissions([]);
      setMessage("");
      return () => controller.abort();
    }
    setMessage("Workbench를 불러오는 중입니다.");
    void Promise.all([
      apiRequest<SelectionProjection>(
        `/api/organizations/${organizationId}/workspaces/${workspaceId}/workbench/selection`,
        { signal: controller.signal },
      ),
      loadAuthorizedRegistry(organizationId, workspaceId, controller.signal, user.is_platform_admin),
    ])
      .then(([projection, registry]) => {
        if (controller.signal.aborted || current !== generation.current) return;
        if (projection.mode !== "react") {
          prepareLegacyRollback();
          window.location.replace(legacyWorkspacePath());
          return;
        }
        let restored: { selectedId?: string } = {};
        try {
          restored = JSON.parse(localStorage.getItem(`agent-factory:shell:v3:${scopeKey}`) ?? "{}");
        } catch {
          /* optional view state */
        }
        const requested = new URLSearchParams(window.location.search).get("task");
        const next =
          registry.find((item) => item.id === requested)?.id ??
          registry.find((item) => item.id === restored.selectedId)?.id ??
          selectedId;
        setPermissions(projection.permissions);
        setEntries(registry);
        const authorizedTask = registry.some((item) => item.id === next) ? next : "workspaces";
        const taskPreference = restoreTaskPreference(authorizedTask);
        setSelectedId(authorizedTask);
        setCustomerState({ workspace: { id: workspaceId }, selection: { documentId: null } });
        setSidebarOpen(taskPreference.sidebarOpen !== false);
        setSidebarWidth(Math.max(180, Math.min(520, Number(taskPreference.sidebarWidth) || 268)));
        setMessage("");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && current === generation.current)
          setMessage(error instanceof Error ? error.message : "Workbench를 불러오지 못했습니다.");
      });
    return () => {
      controller.abort();
      generation.current += 1;
    };
  }, [organizationId, scopeKey, user?.id, user?.is_platform_admin, workspaceId]);

  const persistTask = (taskId: string, next: { sidebarOpen?: boolean; sidebarWidth?: number }) => {
    try {
      localStorage.setItem(taskPreferenceKey(taskId), JSON.stringify({ sidebarOpen, sidebarWidth, ...next }));
    } catch {
      /* optional view state */
    }
  };
  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      setSidebarOpen((open) => {
        persistTask(selectedId, { sidebarOpen: !open });
        return !open;
      });
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [scopeKey, selectedId, sidebarWidth]);
  const chooseTask = (id: string) => {
    persistTask(selectedId, {});
    const restored = restoreTaskPreference(id);
    setSelectedId(id);
    setSidebarOpen(restored.sidebarOpen !== false);
    setSidebarWidth(Math.max(180, Math.min(520, Number(restored.sidebarWidth) || 268)));
    try {
      localStorage.setItem(`agent-factory:shell:v3:${scopeKey}`, JSON.stringify({ selectedId: id }));
    } catch {
      /* optional view state */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("task", id);
    window.history.pushState({}, "", url);
  };
  const selected = entries.find((entry) => entry.id === selectedId);
  const bindingClient = useMemo(
    () => createWorkbenchBindingClient(organizationId, workspaceId),
    [organizationId, workspaceId],
  );
  const setCustomerPath = (path: string, value: RuntimeRecord[string]) =>
    setCustomerState((current) => ({ ...current, [path]: value }));

  if (context.loading)
    return (
      <main className="af-shell-loading">
        <StateView state="loading" />
      </main>
    );
  if (!user)
    return (
      <main className="af-shell-loading">
        <StateView state="error" />
        <p>{context.error ?? "세션이 만료되었습니다. 다시 로그인해 주세요."}</p>
        <a href={legacyWorkspacePath()}>로그인</a>
      </main>
    );
  if (!selected)
    return (
      <main className="af-shell-loading">
        <StateView state="loading" />
        <p>{message}</p>
      </main>
    );
  const native = selected.native;
  const nativeContent =
    native === "organization" ? (
      <OrganizationWorkbench
        organizations={organizations}
        selectedId={organizationId}
        onCreated={context.refreshOrganizations}
        onSelect={(id) => context.selectContext({ organizationId: id, workspaceId: null })}
      />
    ) : native === "workspaces" ? (
      organizationId ? (
        <WorkspaceWorkbench
          organizationId={organizationId}
          personal={Boolean(organizations.find((item) => item.id === organizationId)?.is_personal)}
          selectedId={workspaceId}
          permissions={permissions}
          userId={user.id}
          onSelect={(workspace: WorkspaceRecord) =>
            context.selectContext({ organizationId, workspaceId: workspace.id })
          }
        />
      ) : (
        <>
          <WorkbenchSidebar>
            <StateView state="empty" />
          </WorkbenchSidebar>
          <WorkbenchPanel>
            <p>조직 작업에서 조직을 먼저 선택해 주세요.</p>
          </WorkbenchPanel>
        </>
      )
    ) : native === "schedule" && organizationId && workspaceId ? (
      <ScheduleWorkbench
        key={`${scopeKey}:schedule`}
        userId={user.id}
        organizationId={organizationId}
        workspaceId={workspaceId}
      />
    ) : native === "agents" && organizationId && workspaceId ? (
      <AgentsWorkbench organizationId={organizationId} workspaceId={workspaceId} permissions={permissions} />
    ) : native === "documents" && organizationId && workspaceId ? (
      <DocumentsWorkbench
        key={`${scopeKey}:documents`}
        userId={user.id}
        organizationId={organizationId}
        workspaceId={workspaceId}
        permissions={permissions}
      />
    ) : native === "reporting" && organizationId && workspaceId ? (
      <ReportingWorkbench organizationId={organizationId} workspaceId={workspaceId} />
    ) : native === "connections" && organizationId && workspaceId ? (
      <ConnectionsWorkbench organizationId={organizationId} workspaceId={workspaceId} />
    ) : native === "account" ? (
      <AccountWorkbench
        user={user}
        organization={organizations.find((item) => item.id === organizationId) ?? null}
        workspaceId={workspaceId}
      />
    ) : native === "administration" && user.is_platform_admin ? (
      <AdminWorkbench />
    ) : native ? (
      <>
        <WorkbenchSidebar>
          <StateView state="empty" />
        </WorkbenchSidebar>
        <WorkbenchPanel>
          <p>작업공간을 먼저 선택해 주세요.</p>
        </WorkbenchPanel>
      </>
    ) : null;
  return (
    <WorkbenchFrame sidebarOpen={sidebarOpen} sidebarWidth={sidebarWidth}>
      <WorkbenchTaskList>
        <span className="af-native-logo" aria-label="Agent Factory">
          AF
        </span>
        {entries.map((entry) => (
          <button
            key={`${entry.origin}:${entry.releaseId}`}
            type="button"
            aria-current={entry.id === selectedId ? "page" : undefined}
            title={entry.title}
            onClick={() => chooseTask(entry.id)}
          >
            {taskIcon(entry, entry.id === selectedId)}
            <span>{entry.title}</span>
          </button>
        ))}
        <span className="af-native-task-spacer" />
        <a href={legacyWorkspacePath()} onClick={prepareLegacyRollback}>
          기존 화면
        </a>
        <button
          type="button"
          aria-label="사이드바 표시"
          aria-pressed={sidebarOpen}
          onClick={() => {
            setSidebarOpen(!sidebarOpen);
            persistTask(selectedId, { sidebarOpen: !sidebarOpen });
          }}
        >
          사이드바
        </button>
      </WorkbenchTaskList>
      {selected.origin === "customer" && selected.definition && organizationId && workspaceId ? (
        <WorkbenchRenderer
          embedded
          definition={selected.definition}
          client={bindingClient}
          operations={workbenchOperations}
          scope={{
            userId: user.id,
            organizationId,
            workspaceId,
            workbenchId: selected.id,
            releaseId: selected.releaseId,
          }}
          state={customerState}
          selection={null}
          actionEnvironment={{
            scope: {
              userId: user.id,
              organizationId,
              workspaceId,
              workbenchId: selected.id,
              releaseId: selected.releaseId,
            },
            getScope: () => ({
              userId: user.id,
              organizationId,
              workspaceId,
              workbenchId: selected.id,
              releaseId: selected.releaseId,
            }),
            setState: setCustomerPath,
            submit: async () => undefined,
            navigate: () => undefined,
            dismiss: async () => undefined,
          }}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          onSidebarOpenChange={setSidebarOpen}
          onSidebarWidthChange={setSidebarWidth}
        />
      ) : (
        <>
          {nativeContent}
          {sidebarOpen && (
            <ShellResizeHandle
              width={sidebarWidth}
              onChange={(width) => {
                setSidebarWidth(width);
                persistTask(selectedId, { sidebarWidth: width });
              }}
            />
          )}
        </>
      )}
    </WorkbenchFrame>
  );
}
