import { useEffect, useMemo, useRef, useState } from "react";
import { documentsFixture, type WorkbenchDefinition } from "@agent-factory/contracts";
import { WorkbenchEditor } from "@agent-factory/workbench-editor";
import {
  defaultViewState,
  readViewState,
  WorkbenchRenderer,
  writeViewState,
  type BindingClient,
  type RuntimeRecord,
  type RuntimeScope,
  type RuntimeValue,
} from "@agent-factory/workbench-runtime";
import { useWorkbenchContext } from "./app/WorkbenchContext.js";
import { workbenchClient, type DefinitionRecord, type ReleaseRecord } from "./workbench-client.js";
import { documentOperations } from "./standard/documents/index.js";

let previewDocumentReads = 0;
const previewClient: BindingClient = {
  async execute({ operationId, input, signal }): Promise<RuntimeRecord> {
    await Promise.resolve();
    if (signal.aborted) throw new DOMException("preview cancelled", "AbortError");
    if (operationId === "documents-list@1") {
      const records: RuntimeRecord[] = [
        { id: "overview", label: `미리보기 문서 · ${String(input.workspaceId)}`, meta: "fixture" },
        { id: "guide", label: "시작 안내", parentId: "overview", meta: "child" },
      ];
      return { records };
    }
    if (operationId === "document-read@1") {
      previewDocumentReads += 1;
      return {
        value: `# ${String(input.documentId)}\n\n작성기에서 제어하는 미리보기 데이터입니다. 요청 ${previewDocumentReads}`,
      };
    }
    throw new Error("preview operation is not declared");
  },
};

function usePreviewScope(): RuntimeScope | null {
  const { themeScope } = useWorkbenchContext();
  return useMemo(
    () => (themeScope ? { ...themeScope, workbenchId: "documents", releaseId: "fixture-preview" } : null),
    [themeScope],
  );
}
type AuthoringLoadState =
  | { phase: "loading" | "error"; scopeKey: string; message: string }
  | {
      phase: "ready";
      scopeKey: string;
      record: DefinitionRecord;
      draft: WorkbenchDefinition;
      release: ReleaseRecord | null;
      permissions: string[];
      message: string;
    };
export function RuntimePreview() {
  const scope = usePreviewScope();
  const [state, setState] = useState<RuntimeRecord>(() => ({
    workspace: { id: scope?.workspaceId ?? "unselected" },
    selection: { documentId: "overview" },
  }));
  const [sidebarWidth, setSidebarWidth] = useState(268);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const runtimeState = useMemo(
    () => ({ ...state, workspace: { id: scope?.workspaceId ?? "unselected" } }),
    [scope?.workspaceId, state],
  );
  useEffect(() => {
    if (!scope) return;
    const restored = readViewState(localStorage, scope, new Set(["overview", "guide"]));
    setSidebarWidth(restored.sidebarWidth);
    setSidebarOpen(restored.sidebarOpen);
    setExpanded(restored.expanded);
    setState({ workspace: { id: scope.workspaceId }, selection: { documentId: restored.selection ?? "overview" } });
  }, [scope]);
  if (!scope) return <main role="status">인증된 Workbench 컨텍스트를 기다리는 중입니다.</main>;
  const setPath = (path: string, value: RuntimeValue) =>
    setState((current) => {
      const next = structuredClone(current);
      const segments = path.split(".");
      let target = next;
      for (const segment of segments.slice(0, -1)) {
        const candidate = target[segment];
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) target[segment] = {};
        target = target[segment] as RuntimeRecord;
      }
      target[segments.at(-1)!] = value;
      if (path === "selection.documentId" && typeof value === "string")
        writeViewState(localStorage, scope, {
          ...defaultViewState(scope.workbenchId),
          sidebarOpen,
          sidebarWidth,
          selection: value,
          expanded,
        });
      return next;
    });
  const persist = (changes: Partial<ReturnType<typeof defaultViewState>>) => {
    const selectedId = (state.selection as RuntimeRecord | undefined)?.documentId;
    writeViewState(localStorage, scope, {
      ...defaultViewState(scope.workbenchId),
      sidebarOpen,
      sidebarWidth,
      selection: typeof selectedId === "string" ? selectedId : null,
      expanded,
      ...changes,
    });
  };
  const resizeSidebar = (width: number) => {
    setSidebarWidth(width);
    persist({ sidebarWidth: width });
  };
  return (
    <>
      <WorkbenchRenderer
        definition={documentsFixture}
        client={previewClient}
        operations={documentOperations}
        scope={scope}
        state={runtimeState}
        actionEnvironment={{
          scope,
          getScope: () => scopeRef.current ?? scope,
          setState: setPath,
          submit: async () => undefined,
          navigate: () => undefined,
          dismiss: async () => undefined,
        }}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={resizeSidebar}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={(open) => {
          setSidebarOpen(open);
          persist({ sidebarOpen: open });
        }}
        selection={
          typeof (state.selection as RuntimeRecord | undefined)?.documentId === "string"
            ? String((state.selection as RuntimeRecord).documentId)
            : null
        }
        expanded={expanded}
        onExpandedChange={(ids) => {
          setExpanded(ids);
          persist({ expanded: ids });
        }}
      />
    </>
  );
}
export function WorkbenchAuthoring() {
  const scope = usePreviewScope();
  const scopeKey = scope ? `${scope.userId}:${scope.organizationId}:${scope.workspaceId}` : "unauthenticated";
  const [authoring, setAuthoring] = useState<AuthoringLoadState>(() => ({
    phase: "loading",
    scopeKey,
    message: "Workbench 초안을 불러오는 중입니다.",
  }));
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const publishKey = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const operationController = useRef<AbortController | null>(null);
  const selection = useMemo(() => new URLSearchParams(window.location.search).get("definition"), []);
  useEffect(() => {
    const generation = ++loadGeneration.current;
    const controller = new AbortController();
    operationController.current?.abort();
    setAuthoring({ phase: "loading", scopeKey, message: "Workbench 초안을 불러오는 중입니다." });
    setBusy(null);
    publishKey.current = null;
    const cancel = () => {
      controller.abort();
      if (generation === loadGeneration.current) operationController.current?.abort();
    };
    if (!scope || scope.workspaceId === "unselected") return cancel;
    void (async () => {
      try {
        const index = await workbenchClient.list(scope.organizationId, scope.workspaceId, controller.signal);
        const selected = index.items.find((item) => item.id === selection) ?? index.items[0];
        if (!selected) throw new Error("작성 가능한 Workbench가 없습니다.");
        const loaded = await workbenchClient.draft(
          scope.organizationId,
          scope.workspaceId,
          selected.id,
          controller.signal,
        );
        let loadedRelease: ReleaseRecord | null = null;
        if (loaded.latestReleaseId) {
          loadedRelease = await workbenchClient.release(
            scope.organizationId,
            scope.workspaceId,
            loaded.latestReleaseId,
            controller.signal,
          );
        }
        if (controller.signal.aborted || generation !== loadGeneration.current) return;
        setAuthoring({
          phase: "ready",
          scopeKey,
          record: loaded,
          draft: loaded.definition,
          release: loadedRelease,
          permissions: index.permissions,
          message: "서버 초안을 불러왔습니다.",
        });
      } catch (error) {
        if (!controller.signal.aborted && generation === loadGeneration.current)
          setAuthoring({
            phase: "error",
            scopeKey,
            message: error instanceof Error ? error.message : "Workbench를 불러오지 못했습니다.",
          });
      }
    })();
    return cancel;
  }, [scope, scopeKey, selection]);
  if (!scope) return <main role="status">인증된 Workbench 컨텍스트를 기다리는 중입니다.</main>;
  if (scope.workspaceId === "unselected")
    return (
      <WorkbenchEditor
        initialDefinition={documentsFixture as WorkbenchDefinition}
        client={previewClient}
        operations={documentOperations}
        scope={scope}
        state={{ workspace: { id: scope.workspaceId }, selection: { documentId: "overview" } }}
        publicationNote={<p>서버 작업공간을 선택하면 저장 및 게시 동작을 사용할 수 있습니다.</p>}
      />
    );
  if (authoring.phase !== "ready" || authoring.scopeKey !== scopeKey)
    return (
      <main role="status">
        {authoring.scopeKey === scopeKey ? authoring.message : "Workbench 초안을 불러오는 중입니다."}
      </main>
    );
  const { record, draft, release, permissions, message } = authoring;
  const updateAuthoring = (
    changes: Partial<Omit<Extract<AuthoringLoadState, { phase: "ready" }>, "phase" | "scopeKey">>,
  ) =>
    setAuthoring((current) =>
      current.phase === "ready" && current.scopeKey === scopeKey ? { ...current, ...changes } : current,
    );
  const changed = JSON.stringify(draft) !== JSON.stringify(record.definition);
  const canSave = permissions.includes("workbench.update");
  const canPublish = permissions.includes("workbench.publish");
  const save = async () => {
    if (busy || !canSave) return;
    const generation = loadGeneration.current;
    const controller = new AbortController();
    operationController.current?.abort();
    operationController.current = controller;
    setBusy("save");
    updateAuthoring({ message: "초안을 저장하는 중입니다." });
    try {
      const saved = await workbenchClient.save(
        scope.organizationId,
        scope.workspaceId,
        record,
        draft,
        controller.signal,
      );
      if (controller.signal.aborted || generation !== loadGeneration.current) return;
      updateAuthoring({
        record: saved,
        draft: saved.definition,
        message: `초안 revision ${saved.revision}을 저장했습니다.`,
      });
      publishKey.current = null;
    } catch (error) {
      if (!controller.signal.aborted && generation === loadGeneration.current)
        updateAuthoring({
          message: `${error instanceof Error ? error.message : "저장하지 못했습니다."} 편집 내용은 유지됩니다.`,
        });
    } finally {
      if (generation === loadGeneration.current) setBusy(null);
    }
  };
  const publish = async () => {
    if (busy || changed || !canPublish) return;
    const generation = loadGeneration.current;
    const controller = new AbortController();
    operationController.current?.abort();
    operationController.current = controller;
    setBusy("publish");
    updateAuthoring({ message: "불변 release를 게시하는 중입니다." });
    try {
      publishKey.current ??= crypto.randomUUID();
      const published = await workbenchClient.publish(
        scope.organizationId,
        scope.workspaceId,
        record,
        publishKey.current,
        controller.signal,
      );
      if (controller.signal.aborted || generation !== loadGeneration.current) return;
      updateAuthoring({
        release: published,
        record: { ...record, latestReleaseId: published.id },
        message: `release ${published.releaseNumber}을 게시했습니다.`,
      });
      publishKey.current = null;
    } catch (error) {
      if (!controller.signal.aborted && generation === loadGeneration.current)
        updateAuthoring({
          message: `${error instanceof Error ? error.message : "게시하지 못했습니다."} 초안은 유지됩니다.`,
        });
    } finally {
      if (generation === loadGeneration.current) setBusy(null);
    }
  };
  return (
    <WorkbenchEditor
      key={`${record.id}:${record.revision}`}
      initialDefinition={record.definition}
      client={previewClient}
      operations={documentOperations}
      scope={{ ...scope, workbenchId: record.key, releaseId: `draft-${record.revision}` }}
      state={{ workspace: { id: scope.workspaceId }, selection: { documentId: "overview" } }}
      onDraftChange={(nextDraft) => updateAuthoring({ draft: nextDraft })}
      toolbarActions={
        <>
          <button
            type="button"
            disabled={!canSave || !changed || busy !== null}
            aria-busy={busy === "save"}
            onClick={() => void save()}
          >
            초안 저장
          </button>
          <button
            type="button"
            disabled={!canPublish || changed || busy !== null}
            aria-busy={busy === "publish"}
            onClick={() => void publish()}
          >
            게시
          </button>
        </>
      }
      publicationNote={
        <div className="af-publication-status" role="status">
          <strong>{changed ? "저장되지 않은 변경" : `초안 revision ${record.revision}`}</strong>
          <span>{message}</span>
          {release && (
            <span>
              게시 release {release.releaseNumber} · {release.definitionDigest}
            </span>
          )}
        </div>
      }
      publishedPreview={
        release ? (
          <section className="af-authoring-preview" aria-label="게시된 release 미리보기">
            <h2>게시된 release {release.releaseNumber}</h2>
            <WorkbenchRenderer
              definition={release.definition}
              client={previewClient}
              operations={documentOperations}
              scope={{ ...scope, workbenchId: record.key, releaseId: release.id }}
              state={{ workspace: { id: scope.workspaceId }, selection: { documentId: "overview" } }}
            />
          </section>
        ) : undefined
      }
    />
  );
}
