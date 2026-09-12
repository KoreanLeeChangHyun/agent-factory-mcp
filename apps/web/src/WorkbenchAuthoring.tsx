import { useEffect, useMemo, useRef, useState } from "react";
import { documentsFixture, type AssetParameter, type WorkbenchDefinition } from "@agent-factory/contracts";
import { WorkbenchEditor } from "@agent-factory/workbench-editor";
import {
  defaultViewState,
  readViewState,
  WorkbenchRenderer,
  writeViewState,
  type BindingClient,
  type BindingOperation,
  type RuntimeRecord,
  type RuntimeScope,
  type RuntimeValue,
} from "@agent-factory/workbench-runtime";
import { useWorkbenchContext } from "./app/WorkbenchContext.js";

const previewRecords: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    label: { type: "string", minLength: 1, maxLength: 80 },
    meta: { type: "string", maxLength: 80 },
    parentId: { type: "string", maxLength: 64 },
  },
};
const operationFields = {
  workspaceId: { name: "workspaceId", type: "string", required: true, maxLength: 64 },
  documentId: { name: "documentId", type: "string", required: true, maxLength: 64 },
  records: {
    name: "records",
    type: "record-list",
    required: true,
    maxItems: 100,
    items: previewRecords,
    uniqueBy: "id",
  },
  value: { name: "value", type: "string", required: true, maxLength: 2048 },
} as const;
const previewOperations: readonly BindingOperation[] = [
  { id: "documents-list@1", inputs: [operationFields.workspaceId], outputs: [operationFields.records] },
  { id: "document-read@1", inputs: [operationFields.documentId], outputs: [operationFields.value] },
];
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
    const restored = readViewState(sessionStorage, scope, new Set(["overview", "guide"]));
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
        writeViewState(sessionStorage, scope, {
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
    writeViewState(sessionStorage, scope, {
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
        operations={previewOperations}
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
  if (!scope) return <main role="status">인증된 Workbench 컨텍스트를 기다리는 중입니다.</main>;
  return (
    <WorkbenchEditor
      initialDefinition={documentsFixture as WorkbenchDefinition}
      client={previewClient}
      operations={previewOperations}
      scope={scope}
      state={{ workspace: { id: scope.workspaceId }, selection: { documentId: "overview" } }}
    />
  );
}
