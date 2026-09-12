import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { instantiateAsset, ShellResizeHandle, WorkbenchFrame, WorkbenchTaskList } from "@agent-factory/design-system";
import { WorkbenchRenderer, type BindingClient, type RuntimeRecord } from "@agent-factory/workbench-runtime";
import { apiRequest } from "../api-client.js";
import { legacyWorkspacePath } from "../api-path.js";
import { useWorkbenchContext } from "../app/WorkbenchContext.js";
import { loadAuthorizedRegistry, type RegisteredWorkbench } from "../registry/WorkbenchRegistry.js";
import { documentClient } from "../standard/documents/document-client.js";
import { DocumentsWorkbench } from "../standard/documents/DocumentsWorkbench.js";
import { documentOperations } from "../standard/documents/document-operations.js";

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
  const { themeScope } = useWorkbenchContext();
  const [entries, setEntries] = useState<RegisteredWorkbench[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("documents");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(268);
  const [message, setMessage] = useState("Workbench를 불러오는 중입니다.");
  const [customerState, setCustomerState] = useState<RuntimeRecord>({ selection: { documentId: null } });
  const generation = useRef(0);
  const organizationId = themeScope?.organizationId ?? "unselected";
  const workspaceId = themeScope?.workspaceId ?? "unselected";
  const scopeKey = themeScope ? `${themeScope.userId}:${organizationId}:${workspaceId}` : "unauthenticated";
  const prepareLegacyRollback = () => {
    if (!themeScope || organizationId === "unselected" || workspaceId === "unselected") return;
    try {
      const documentId = new URLSearchParams(window.location.search).get("document");
      sessionStorage.setItem(
        `agent-factory:workbench-rollback:v1:${themeScope.userId}:${organizationId}:${workspaceId}`,
        "legacy-once",
      );
      localStorage.setItem(`agentFactoryOrganizationId:${themeScope.userId}`, organizationId);
      localStorage.setItem(
        `agentFactorySelection:${themeScope.userId}:${organizationId}`,
        JSON.stringify({
          workspaceId,
          mode: "workspace",
          activity: "documents",
          documentView: "original-overview",
          workbenchTaskId: selectedId,
          workbenchDocumentId: documentId,
        }),
      );
    } catch {
      /* Legacy selection conversion is optional; server authorization still gates restoration. */
    }
  };

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setEntries([]);
    setMessage("Workbench를 불러오는 중입니다.");
    if (!themeScope || organizationId === "unselected" || workspaceId === "unselected") {
      setMessage("인증된 조직과 작업공간을 선택해야 합니다.");
      return () => controller.abort();
    }
    void Promise.all([
      apiRequest<SelectionProjection>(
        `/api/organizations/${organizationId}/workspaces/${workspaceId}/workbench/selection`,
        { signal: controller.signal },
      ),
      loadAuthorizedRegistry(organizationId, workspaceId, controller.signal),
    ])
      .then(([selection, registry]) => {
        if (controller.signal.aborted || current !== generation.current) return;
        if (selection.mode !== "react") {
          prepareLegacyRollback();
          window.location.replace(legacyWorkspacePath());
          return;
        }
        const storageKey = `agent-factory:shell:v2:${scopeKey}`;
        let restored: { selectedId?: string; sidebarOpen?: boolean; sidebarWidth?: number } = {};
        try {
          restored = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
        } catch {
          restored = {};
        }
        const requested = new URLSearchParams(window.location.search).get("task");
        const nextId = registry.some((item) => item.id === requested)
          ? requested!
          : registry.some((item) => item.id === restored.selectedId)
            ? restored.selectedId!
            : "documents";
        setPermissions(selection.permissions);
        setEntries(registry);
        setSelectedId(nextId);
        setCustomerState({ workspace: { id: workspaceId }, selection: { documentId: null } });
        setSidebarOpen(restored.sidebarOpen !== false);
        setSidebarWidth(Math.max(180, Math.min(520, Number(restored.sidebarWidth) || 268)));
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
  }, [organizationId, scopeKey, themeScope, workspaceId]);

  const persist = (next: { selectedId?: string; sidebarOpen?: boolean; sidebarWidth?: number }) => {
    try {
      localStorage.setItem(
        `agent-factory:shell:v2:${scopeKey}`,
        JSON.stringify({ selectedId, sidebarOpen, sidebarWidth, ...next }),
      );
    } catch {
      /* Optional view state. */
    }
  };
  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== "b") return;
      event.preventDefault();
      setSidebarOpen((open) => {
        persist({ sidebarOpen: !open });
        return !open;
      });
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [scopeKey, selectedId, sidebarWidth]);
  const selected = entries.find((entry) => entry.id === selectedId);
  const setCustomerPath = (path: string, value: RuntimeRecord[string]) =>
    setCustomerState((current) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let target = next;
      for (const part of parts.slice(0, -1)) {
        if (!target[part] || typeof target[part] !== "object" || Array.isArray(target[part])) target[part] = {};
        target = target[part] as RuntimeRecord;
      }
      target[parts.at(-1)!] = value;
      return next;
    });
  const bindingClient = useMemo<BindingClient>(
    () => ({
      async execute({ operationId, input, signal }): Promise<RuntimeRecord> {
        const started = performance.now();
        try {
          if (operationId === "documents-list@1") {
            const rows = await documentClient.list(organizationId, workspaceId, signal);
            return { records: rows.map((row) => ({ id: row.id, label: row.title, meta: row.document_type })) };
          }
          if (operationId === "document-read@1") {
            const row = await documentClient.get(organizationId, workspaceId, String(input.documentId), signal);
            if (!row.current_revision_number) return { value: "내용이 없습니다." };
            const result = await documentClient.content(
              organizationId,
              workspaceId,
              row.id,
              row.current_revision_number,
              signal,
            );
            return { value: (await result.blob.text()).slice(0, 2048) };
          }
          throw new Error("허용되지 않은 binding operation입니다.");
        } finally {
          performance.measure(`workbench-binding:${operationId}`, { start: started, end: performance.now() });
        }
      },
    }),
    [organizationId, workspaceId],
  );
  if (!themeScope || !selected)
    return (
      <main className="af-shell-loading" role={message.includes("못") ? "alert" : "status"}>
        {message}
      </main>
    );
  return (
    <WorkbenchFrame sidebarOpen={sidebarOpen} sidebarWidth={sidebarWidth}>
      <WorkbenchTaskList>
        {entries.map((entry) => (
          <button
            key={`${entry.origin}:${entry.releaseId}`}
            type="button"
            aria-current={entry.id === selectedId ? "page" : undefined}
            title={entry.title}
            onClick={() => {
              setSelectedId(entry.id);
              setSidebarOpen(true);
              persist({ selectedId: entry.id, sidebarOpen: true });
            }}
          >
            {taskIcon(entry, entry.id === selectedId)}
            <span>{entry.title}</span>
          </button>
        ))}
        <button
          type="button"
          aria-label="사이드바 표시"
          aria-pressed={sidebarOpen}
          onClick={() => {
            setSidebarOpen(!sidebarOpen);
            persist({ sidebarOpen: !sidebarOpen });
          }}
        >
          사이드바
        </button>
        <a href={legacyWorkspacePath()} onClick={prepareLegacyRollback}>
          기존 화면
        </a>
      </WorkbenchTaskList>
      {selected.origin === "standard" ? (
        <>
          <DocumentsWorkbench
            key={`${scopeKey}:documents`}
            userId={themeScope.userId}
            organizationId={organizationId}
            workspaceId={workspaceId}
            permissions={permissions}
          />
          {sidebarOpen && (
            <ShellResizeHandle
              width={sidebarWidth}
              onChange={(width) => {
                setSidebarWidth(width);
                persist({ sidebarWidth: width });
              }}
            />
          )}
        </>
      ) : (
        <WorkbenchRenderer
          embedded
          definition={selected.definition}
          client={bindingClient}
          operations={documentOperations}
          scope={{
            ...themeScope,
            organizationId,
            workspaceId,
            workbenchId: selected.id,
            releaseId: selected.releaseId,
          }}
          state={customerState}
          selection={
            typeof (customerState.selection as RuntimeRecord | undefined)?.documentId === "string"
              ? String((customerState.selection as RuntimeRecord).documentId)
              : null
          }
          actionEnvironment={{
            scope: {
              ...themeScope,
              organizationId,
              workspaceId,
              workbenchId: selected.id,
              releaseId: selected.releaseId,
            },
            getScope: () => ({
              ...themeScope,
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
          onSidebarOpenChange={(open) => {
            setSidebarOpen(open);
            persist({ sidebarOpen: open });
          }}
          onSidebarWidthChange={(width) => {
            setSidebarWidth(width);
            persist({ sidebarWidth: width });
          }}
        />
      )}
    </WorkbenchFrame>
  );
}
